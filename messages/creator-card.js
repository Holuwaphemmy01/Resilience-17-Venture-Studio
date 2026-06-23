const CreatorCardMessages = {
  // Centralized messages keep response text and custom error cases consistent.
  CREATED_SUCCESSFULLY: 'Creator Card Created Successfully.',
  RETRIEVED_SUCCESSFULLY: 'Creator Card Retrieved Successfully.',
  DELETED_SUCCESSFULLY: 'Creator Card Deleted Successfully.',
  SLUG_ALREADY_TAKEN: 'Slug is already taken',
  PRIVATE_ACCESS_CODE_REQUIRED: 'access_code is required when access_type is private',
  PUBLIC_ACCESS_CODE_NOT_ALLOWED: 'access_code can only be set on private cards',
  CREATOR_CARD_NOT_FOUND: 'Creator card not found',
  PRIVATE_CARD_ACCESS_CODE_REQUIRED: 'This card is private. An access code is required',
  INVALID_PRIVATE_CARD_ACCESS_CODE: 'Invalid access code',
  INVALID_SLUG: 'slug may only contain letters, numbers, hyphens, and underscores',
  INVALID_LINK_URL: 'links[].url must start with http:// or https://',
  INVALID_ACCESS_CODE: 'access_code must be exactly 6 alphanumeric characters',
  INVALID_RATE_AMOUNT: 'service_rates.rates[].amount must be a positive integer',
};

module.exports = CreatorCardMessages;
