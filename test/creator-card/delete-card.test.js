const assert = require('assert');
const deleteCreatorCard = require('@app/services/creator-card/delete-card');

const DELETED_TIMESTAMP = 1767139200000;
const DEFAULT_CARD = {
  _id: 'card_1',
  title: 'George Cooks',
  description: 'Weekly cooking podcast',
  slug: 'george-cooks',
  creator_reference: 'crt_8f2k1m9x4p7w3q5z',
  links: [{ title: 'YouTube', url: 'https://youtube.com/@georgecooks' }],
  service_rates: {
    currency: 'NGN',
    rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 5000000 }],
  },
  status: 'published',
  access_type: 'private',
  access_code: 'A1B2C3',
  created: 1767052800000,
  updated: 1767052800000,
  deleted: null,
};

async function assertRejectsWithCode(operation, expectedCode) {
  let capturedError;

  try {
    await operation();
  } catch (error) {
    capturedError = error;
  }

  assert(capturedError, `Expected operation to reject with ${expectedCode}`);
  assert.strictEqual(capturedError.errorCode, expectedCode);
}

function createCreatorCard(overrides = {}) {
  return {
    ...DEFAULT_CARD,
    ...overrides,
  };
}

function createRepositoryDouble(cardsBySlug = {}) {
  const updateCalls = [];

  return {
    updateCalls,
    async findOne({ query }) {
      const creatorCard = cardsBySlug[query.slug] || null;

      if (!creatorCard) return null;
      if (query.creator_reference && creatorCard.creator_reference !== query.creator_reference) {
        return null;
      }
      if (query.deleted === null && creatorCard.deleted !== null) return null;

      return creatorCard;
    },
    async updateOne(updateConfig) {
      updateCalls.push(updateConfig);
      const creatorCard = cardsBySlug[updateConfig.query.slug];

      if (creatorCard) {
        creatorCard.deleted = updateConfig.updateValues.deleted;
      }

      return { acknowledged: true, modifiedCount: creatorCard ? 1 : 0 };
    },
  };
}

describe('deleteCreatorCard', () => {
  it('soft deletes a creator card and returns the creation response format', async () => {
    const repository = createRepositoryDouble({
      'george-cooks': createCreatorCard(),
    });
    const response = await deleteCreatorCard(
      {
        slug: 'george-cooks',
        creator_reference: 'crt_8f2k1m9x4p7w3q5z',
      },
      {
        repository,
        getCurrentTimestamp: () => DELETED_TIMESTAMP,
      }
    );

    assert.strictEqual(response.id, 'card_1');
    assert.strictEqual(response._id, undefined);
    assert.strictEqual(response.slug, 'george-cooks');
    assert.strictEqual(response.access_code, 'A1B2C3');
    assert.strictEqual(response.deleted, DELETED_TIMESTAMP);
    assert.strictEqual(response.updated, DELETED_TIMESTAMP);
    assert.strictEqual(repository.updateCalls.length, 1);
    assert.deepStrictEqual(repository.updateCalls[0].query, {
      slug: 'george-cooks',
      creator_reference: 'crt_8f2k1m9x4p7w3q5z',
      deleted: null,
    });
  });

  it('returns NF01 when no card exists for the slug', async () => {
    const repository = createRepositoryDouble();

    await assertRejectsWithCode(
      () =>
        deleteCreatorCard(
          {
            slug: 'does-not-exist-123',
            creator_reference: 'crt_q1w2e3r4t5y6u7i8',
          },
          { repository }
        ),
      'NF01'
    );
  });

  it('returns NF01 when the creator reference does not own the card', async () => {
    const repository = createRepositoryDouble({
      'george-cooks': createCreatorCard(),
    });

    await assertRejectsWithCode(
      () =>
        deleteCreatorCard(
          {
            slug: 'george-cooks',
            creator_reference: 'crt_q1w2e3r4t5y6u7i8',
          },
          { repository }
        ),
      'NF01'
    );
  });

  it('returns NF01 when the card is already deleted', async () => {
    const repository = createRepositoryDouble({
      'george-cooks': createCreatorCard({ deleted: DELETED_TIMESTAMP }),
    });

    await assertRejectsWithCode(
      () =>
        deleteCreatorCard(
          {
            slug: 'george-cooks',
            creator_reference: 'crt_8f2k1m9x4p7w3q5z',
          },
          { repository }
        ),
      'NF01'
    );
  });
});
