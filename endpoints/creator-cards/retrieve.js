const { createHandler } = require('@app-core/server');
const { CreatorCardMessages } = require('@app/messages');
const retrieveCreatorCard = require('@app/services/creator-card/retrieve-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  middlewares: [],
  async handler(rc, helpers) {
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
