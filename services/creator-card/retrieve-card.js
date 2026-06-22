const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const creatorCardRepository = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-card');

const CUSTOM_ERROR_CODE = {
  CREATOR_CARD_NOT_FOUND: 'NF01',
  CREATOR_CARD_IS_DRAFT: 'NF02',
  PRIVATE_CARD_ACCESS_CODE_REQUIRED: 'AC03',
  INVALID_PRIVATE_CARD_ACCESS_CODE: 'AC04',
};

const retrieveCreatorCardSpec = `root {
  slug string<trim|minLength:1>
  access_code? string<trim>
}`;

const parsedRetrieveCreatorCardSpec = validator.parse(retrieveCreatorCardSpec);

function throwCreatorCardNotFound(errorCode) {
  throwAppError(CreatorCardMessages.CREATOR_CARD_NOT_FOUND, errorCode);
}

function cardHasBeenDeleted(creatorCard) {
  return typeof creatorCard.deleted !== 'undefined' && creatorCard.deleted !== null;
}

function enforcePublicAccessRules(creatorCard, accessCode) {
  if (creatorCard.status === 'draft') {
    throwCreatorCardNotFound(CUSTOM_ERROR_CODE.CREATOR_CARD_IS_DRAFT);
  }

  if (creatorCard.access_type === 'private' && !accessCode) {
    throwAppError(
      CreatorCardMessages.PRIVATE_CARD_ACCESS_CODE_REQUIRED,
      CUSTOM_ERROR_CODE.PRIVATE_CARD_ACCESS_CODE_REQUIRED
    );
  }

  if (creatorCard.access_type === 'private' && accessCode !== creatorCard.access_code) {
    throwAppError(
      CreatorCardMessages.INVALID_PRIVATE_CARD_ACCESS_CODE,
      CUSTOM_ERROR_CODE.INVALID_PRIVATE_CARD_ACCESS_CODE
    );
  }
}

async function retrieveCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedRetrieveCreatorCardSpec);
  const repository = options.repository || creatorCardRepository;
  const creatorCard = await repository.findOne({
    query: { slug: data.slug, deleted: null },
  });

  if (!creatorCard || cardHasBeenDeleted(creatorCard)) {
    throwCreatorCardNotFound(CUSTOM_ERROR_CODE.CREATOR_CARD_NOT_FOUND);
  }

  enforcePublicAccessRules(creatorCard, data.access_code);
  const response = serializeCreatorCard(creatorCard, { includeAccessCode: false });

  return response;
}

module.exports = retrieveCreatorCard;
