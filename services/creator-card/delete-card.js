const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');
const creatorCardRepository = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-card');

const CUSTOM_ERROR_CODE = {
  CREATOR_CARD_NOT_FOUND: 'NF01',
};

// Validates both the public slug and creator_reference ownership check.
const deleteCreatorCardSpec = `root {
  slug string<trim|minLength:1>
  creator_reference string<trim|length:20>
}`;

const parsedDeleteCreatorCardSpec = validator.parse(deleteCreatorCardSpec);

function throwCreatorCardNotFound() {
  throwAppError(
    CreatorCardMessages.CREATOR_CARD_NOT_FOUND,
    CUSTOM_ERROR_CODE.CREATOR_CARD_NOT_FOUND
  );
}

function cardHasBeenDeleted(creatorCard) {
  return typeof creatorCard.deleted !== 'undefined' && creatorCard.deleted !== null;
}

async function deleteCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedDeleteCreatorCardSpec);
  const repository = options.repository || creatorCardRepository;
  // Injectable clock keeps soft-delete assertions deterministic in unit tests.
  const getCurrentTimestamp = options.getCurrentTimestamp || Date.now;
  const creatorCard = await repository.findOne({
    query: {
      slug: data.slug,
      creator_reference: data.creator_reference,
      deleted: null,
    },
  });

  if (!creatorCard || cardHasBeenDeleted(creatorCard)) {
    throwCreatorCardNotFound();
  }

  // Soft delete preserves an audit timestamp and prevents future public retrieval.
  const deletedAt = getCurrentTimestamp();
  const deleteResult = await repository.updateOne({
    query: {
      slug: data.slug,
      creator_reference: data.creator_reference,
      deleted: null,
    },
    updateValues: { deleted: deletedAt },
  });

  if (!deleteResult.modifiedCount) {
    // A concurrent delete should behave like a missing card and return NF01.
    throwCreatorCardNotFound();
  }

  // Deletion returns the creation response shape, including access_code and deleted.
  const response = serializeCreatorCard({
    ...creatorCard,
    deleted: deletedAt,
    updated: deletedAt,
  });

  return response;
}

module.exports = deleteCreatorCard;
