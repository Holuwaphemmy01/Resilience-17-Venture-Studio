const { createHandler } = require('@app-core/server');
const { CreatorCardMessages } = require('@app/messages');
const createCreatorCard = require('@app/services/creator-card/create-card');

module.exports = createHandler({
  path: '/creator-cards',
  method: 'post',
  // Public by assessment requirement: no API keys, bearer tokens, or auth middleware.
  middlewares: [],
  async handler(rc, helpers) {
    // The service owns validation and business rules; this layer only maps HTTP.
    const createdCard = await createCreatorCard(rc.body);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CREATED_SUCCESSFULLY,
      data: createdCard,
    };
  },
});
