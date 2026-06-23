const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { randomBytes } = require('@app-core/randomness');
const { CreatorCardMessages } = require('@app/messages');
const creatorCardRepository = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-card');

const CUSTOM_ERROR_CODE = {
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  // Assessment business-rule codes. Validator failures still return framework 400s.
  SLUG_ALREADY_TAKEN: 'SL02',
  PRIVATE_ACCESS_CODE_REQUIRED: 'AC01',
  PUBLIC_ACCESS_CODE_NOT_ALLOWED: 'AC05',
};

// Template validator spec for field-level rules such as required fields,
// string lengths, enums, casing, and nested service rate shapes.
const createCreatorCardSpec = `root {
  title string<trim|lengthBetween:3,100>
  description? string<trim|maxLength:500>
  slug? string<trim|lengthBetween:5,50>
  creator_reference string<trim|length:20>
  links[]? {
    title string<trim|lengthBetween:1,100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string<trim|uppercase>(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|lengthBetween:3,100>
      description string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string<trim|lowercase>(draft|published)
  access_type? string<trim|lowercase>(public|private)
  access_code? string<trim|length:6>
}`;

const parsedCreateCreatorCardSpec = validator.parse(createCreatorCardSpec);

function isAlphaNumeric(character) {
  const charCode = character.charCodeAt(0);
  const isNumber = charCode >= 48 && charCode <= 57;
  const isUppercaseLetter = charCode >= 65 && charCode <= 90;
  const isLowercaseLetter = charCode >= 97 && charCode <= 122;

  return isNumber || isUppercaseLetter || isLowercaseLetter;
}

function isValidSlugCharacter(character) {
  return isAlphaNumeric(character) || character === '-' || character === '_';
}

function isWhitespace(character) {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

function validateSlugFormat(slug) {
  let isValid = true;

  for (let index = 0; index < slug.length; index += 1) {
    if (!isValidSlugCharacter(slug[index])) {
      isValid = false;
      break;
    }
  }

  if (!isValid) {
    throwAppError(CreatorCardMessages.INVALID_SLUG, ERROR_CODE.INVLDDATA);
  }
}

function validateAccessCodeFormat(accessCode) {
  let isValid = true;

  for (let index = 0; index < accessCode.length; index += 1) {
    if (!isAlphaNumeric(accessCode[index])) {
      isValid = false;
      break;
    }
  }

  if (!isValid) {
    throwAppError(CreatorCardMessages.INVALID_ACCESS_CODE, ERROR_CODE.INVLDDATA);
  }
}

function validateLinks(links = []) {
  // Validator checks the value is a string; this enforces usable web URLs.
  links.forEach((link) => {
    const startsWithHttp = link.url.startsWith('http://');
    const startsWithHttps = link.url.startsWith('https://');

    if (!startsWithHttp && !startsWithHttps) {
      throwAppError(CreatorCardMessages.INVALID_LINK_URL, ERROR_CODE.INVLDDATA);
    }
  });
}

function validateServiceRates(serviceRates) {
  if (!serviceRates) return;

  // Amounts are stored in the smallest currency unit, so fractions are rejected.
  serviceRates.rates.forEach((rate) => {
    if (!Number.isInteger(rate.amount)) {
      throwAppError(CreatorCardMessages.INVALID_RATE_AMOUNT, ERROR_CODE.INVLDDATA);
    }
  });
}

function createSlugFromTitle(title) {
  // Deterministic slug generation keeps tests predictable and URLs readable.
  const lowerCaseTitle = title.toLowerCase();
  let slug = '';
  let previousCharacterWasHyphen = false;

  for (let index = 0; index < lowerCaseTitle.length; index += 1) {
    const character = lowerCaseTitle[index];

    if (isWhitespace(character)) {
      if (!previousCharacterWasHyphen) {
        slug += '-';
        previousCharacterWasHyphen = true;
      }
    } else if (isValidSlugCharacter(character)) {
      slug += character;
      previousCharacterWasHyphen = character === '-';
    }
  }

  return slug;
}

async function findCardBySlug(slug, repository) {
  const existingCard = await repository.findOne({
    query: { slug },
  });

  return existingCard;
}

async function ensureClientSlugIsAvailable(slug, repository) {
  // Client-supplied slugs fail with SL02 instead of changing the requested URL.
  const existingCard = await findCardBySlug(slug, repository);

  if (existingCard) {
    throwAppError(CreatorCardMessages.SLUG_ALREADY_TAKEN, CUSTOM_ERROR_CODE.SLUG_ALREADY_TAKEN);
  }
}

async function createAvailableGeneratedSlug(baseSlug, repository, generateSuffix) {
  // Auto-generated slugs may receive suffixes to satisfy length and uniqueness.
  const candidateSlug = baseSlug.length < 5 ? `${baseSlug}-${generateSuffix()}` : baseSlug;
  const existingCard = await findCardBySlug(candidateSlug, repository);

  if (!existingCard) {
    return candidateSlug;
  }

  return createAvailableGeneratedSlug(
    `${baseSlug}-${generateSuffix()}`,
    repository,
    generateSuffix
  );
}

async function resolveSlug(data, repository, generateSuffix) {
  const resolvedSlug = data.slug || createSlugFromTitle(data.title);

  validateSlugFormat(resolvedSlug);

  if (data.slug) {
    await ensureClientSlugIsAvailable(resolvedSlug, repository);
    return resolvedSlug;
  }

  return createAvailableGeneratedSlug(resolvedSlug, repository, generateSuffix);
}

function validateAccessRules(data) {
  const accessType = data.access_type || 'public';

  // Private cards must have a pin; public cards must not carry hidden pins.
  if (accessType === 'private' && !data.access_code) {
    throwAppError(
      CreatorCardMessages.PRIVATE_ACCESS_CODE_REQUIRED,
      CUSTOM_ERROR_CODE.PRIVATE_ACCESS_CODE_REQUIRED
    );
  }

  if (accessType === 'public' && data.access_code) {
    throwAppError(
      CreatorCardMessages.PUBLIC_ACCESS_CODE_NOT_ALLOWED,
      CUSTOM_ERROR_CODE.PUBLIC_ACCESS_CODE_NOT_ALLOWED
    );
  }

  if (data.access_code) {
    validateAccessCodeFormat(data.access_code);
  }
}

async function createCreatorCard(serviceData, options = {}) {
  let response;
  const data = validator.validate(serviceData, parsedCreateCreatorCardSpec);
  const repository = options.repository || creatorCardRepository;
  // Injectable suffix generation makes slug-collision tests deterministic.
  const generateSuffix = options.generateSuffix || (() => randomBytes(6));

  validateAccessRules(data);
  validateLinks(data.links);
  validateServiceRates(data.service_rates);

  const slug = await resolveSlug(data, repository, generateSuffix);
  const accessType = data.access_type || 'public';
  // Normalize optional fields so stored documents and responses are predictable.
  const cardPayload = {
    title: data.title,
    description: data.description || null,
    slug,
    creator_reference: data.creator_reference,
    links: data.links || [],
    service_rates: data.service_rates || null,
    status: data.status,
    access_type: accessType,
    access_code: accessType === 'private' ? data.access_code : null,
    deleted: null,
  };

  try {
    const createdCard = await repository.create(cardPayload);
    response = serializeCreatorCard(createdCard);
  } catch (error) {
    // Database uniqueness is the race-condition fallback for duplicate slugs.
    if (error.errorCode === CUSTOM_ERROR_CODE.DUPLICATE_RECORD) {
      throwAppError(CreatorCardMessages.SLUG_ALREADY_TAKEN, CUSTOM_ERROR_CODE.SLUG_ALREADY_TAKEN);
    }

    throw error;
  }

  return response;
}

module.exports = createCreatorCard;
