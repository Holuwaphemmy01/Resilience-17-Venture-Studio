function serializeCreatorCard(creatorCard, options = {}) {
  const { includeAccessCode = true } = options;
  const cardDocument = creatorCard._doc || creatorCard;
  const { _id, __v, ...cardData } = cardDocument;
  // API responses expose id, never Mongo's internal _id. Sharing this mapper
  // keeps create, retrieve, and delete responses consistent.
  const serializedCard = {
    id: _id,
    title: cardData.title,
    description: cardData.description || null,
    slug: cardData.slug,
    creator_reference: cardData.creator_reference,
    links: cardData.links || [],
    service_rates: cardData.service_rates || null,
    status: cardData.status,
    access_type: cardData.access_type,
    created: cardData.created,
    updated: cardData.updated,
    deleted: cardData.deleted ?? null,
  };

  if (includeAccessCode) {
    // Create/delete keep the creation shape; retrieval opts out to avoid pin leaks.
    serializedCard.access_code = cardData.access_code || null;
  }

  return serializedCard;
}

module.exports = serializeCreatorCard;
