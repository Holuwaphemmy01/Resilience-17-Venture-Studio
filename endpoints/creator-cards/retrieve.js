const { createHandler } = require('@app-core/server');
const { CreatorCardMessages } = require('@app/messages');
const retrieveCreatorCard = require('@app/services/creator-card/retrieve-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  // Public route. Private cards are protected by access_code checks in the service.
  middlewares: [],
  async handler(rc, helpers) {
    // access_code is optional for public cards and required for private cards.
    const creatorCard = await retrieveCreatorCard({
      slug: rc.params.slug,
      access_code: rc.query.access_code,
    });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.RETRIEVED_SUCCESSFULLY,
      data: creatorCard,
    };
  },
});
