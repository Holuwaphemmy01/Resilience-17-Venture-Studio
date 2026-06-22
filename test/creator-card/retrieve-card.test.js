const assert = require('assert');
const retrieveCreatorCard = require('@app/services/creator-card/retrieve-card');

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
  access_type: 'public',
  access_code: null,
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

function createRepositoryDouble(cardsBySlug = {}) {
  return {
    async findOne({ query }) {
      const creatorCard = cardsBySlug[query.slug] || null;

      if (!creatorCard) return null;
      if (query.deleted === null && creatorCard.deleted !== null) return null;

      return creatorCard;
    },
  };
}

function createCreatorCard(overrides = {}) {
  return {
    ...DEFAULT_CARD,
    ...overrides,
  };
}

describe('retrieveCreatorCard', () => {
  it('retrieves a public published card and omits access_code', async () => {
    const repository = createRepositoryDouble({
      'george-cooks': createCreatorCard({ access_code: 'A1B2C3' }),
    });
    const response = await retrieveCreatorCard({ slug: 'george-cooks' }, { repository });

    assert.strictEqual(response.id, 'card_1');
    assert.strictEqual(response._id, undefined);
    assert.strictEqual(response.slug, 'george-cooks');
    assert.strictEqual(Object.hasOwn(response, 'access_code'), false);
  });

  it('returns NF01 when the card does not exist', async () => {
    const repository = createRepositoryDouble();

    await assertRejectsWithCode(
      () => retrieveCreatorCard({ slug: 'does-not-exist-123' }, { repository }),
      'NF01'
    );
  });

  it('returns NF02 when the card exists but is a draft', async () => {
    const repository = createRepositoryDouble({
      'my-draft-card': createCreatorCard({ slug: 'my-draft-card', status: 'draft' }),
    });

    await assertRejectsWithCode(
      () => retrieveCreatorCard({ slug: 'my-draft-card' }, { repository }),
      'NF02'
    );
  });

  it('returns AC03 when a private card is requested without an access code', async () => {
    const repository = createRepositoryDouble({
      'vip-rate-card': createCreatorCard({
        slug: 'vip-rate-card',
        access_type: 'private',
        access_code: 'A1B2C3',
      }),
    });

    await assertRejectsWithCode(
      () => retrieveCreatorCard({ slug: 'vip-rate-card' }, { repository }),
      'AC03'
    );
  });

  it('returns AC04 when a private card access code is wrong', async () => {
    const repository = createRepositoryDouble({
      'vip-rate-card': createCreatorCard({
        slug: 'vip-rate-card',
        access_type: 'private',
        access_code: 'A1B2C3',
      }),
    });

    await assertRejectsWithCode(
      () => retrieveCreatorCard({ slug: 'vip-rate-card', access_code: 'WRONG1' }, { repository }),
      'AC04'
    );
  });

  it('retrieves a private card with the correct access code and still omits access_code', async () => {
    const repository = createRepositoryDouble({
      'vip-rate-card': createCreatorCard({
        slug: 'vip-rate-card',
        access_type: 'private',
        access_code: 'A1B2C3',
      }),
    });
    const response = await retrieveCreatorCard(
      { slug: 'vip-rate-card', access_code: 'A1B2C3' },
      { repository }
    );

    assert.strictEqual(response.slug, 'vip-rate-card');
    assert.strictEqual(Object.hasOwn(response, 'access_code'), false);
  });

  it('returns NF01 when the card has been deleted', async () => {
    const repository = createRepositoryDouble({
      'deleted-card': createCreatorCard({ slug: 'deleted-card', deleted: 1767139200000 }),
    });

    await assertRejectsWithCode(
      () => retrieveCreatorCard({ slug: 'deleted-card' }, { repository }),
      'NF01'
    );
  });
});
