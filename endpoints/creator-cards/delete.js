const { createHandler } = require('@app-core/server');
const { CreatorCardMessages } = require('@app/messages');
const deleteCreatorCard = require('@app/services/creator-card/delete-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  // Public by assessment requirement; creator_reference acts as the ownership check.
  middlewares: [],
  async handler(rc, helpers) {
    // Delete is a soft delete and returns the card in the creation response shape.
    const deletedCard = await deleteCreatorCard({
      slug: rc.params.slug,
      creator_reference: rc.body.creator_reference,
    });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.DELETED_SUCCESSFULLY,
      data: deletedCard,
    };
  },
});
