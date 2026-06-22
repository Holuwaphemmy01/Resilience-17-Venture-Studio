function serializeCreatorCard(creatorCard, options = {}) {
  const { includeAccessCode = true } = options;
  const cardDocument = creatorCard._doc || creatorCard;
  const { _id, __v, ...cardData } = cardDocument;
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
    serializedCard.access_code = cardData.access_code || null;
  }

  return serializedCard;
}

module.exports = serializeCreatorCard;
