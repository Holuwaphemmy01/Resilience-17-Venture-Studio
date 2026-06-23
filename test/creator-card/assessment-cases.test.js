const assert = require('assert');
const createCreatorCard = require('@app/services/creator-card/create-card');
const retrieveCreatorCard = require('@app/services/creator-card/retrieve-card');
const deleteCreatorCard = require('@app/services/creator-card/delete-card');

const HTTP_STATUS_BY_CODE = {
  AC01: 400,
  AC03: 403,
  AC04: 403,
  AC05: 400,
  NF01: 404,
  NF02: 404,
  SL02: 400,
  SPCL_VALIDATION: 400,
};

function createStatefulRepository() {
  const cardsBySlug = {};
  let nextId = 1;
  let nextTimestamp = 1767052800000;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function matchesQuery(card, query) {
    return Object.entries(query).every(([key, value]) => card[key] === value);
  }

  return {
    cardsBySlug,
    async findOne({ query }) {
      const card = Object.values(cardsBySlug).find((candidate) => matchesQuery(candidate, query));
      return card ? clone(card) : null;
    },
    async create(cardPayload) {
      if (cardsBySlug[cardPayload.slug]) {
        const error = new Error('Duplicate slug');
        error.isApplicationError = true;
        error.errorCode = 'DUPLICATE_RECORD';
        throw error;
      }

      const createdCard = {
        ...clone(cardPayload),
        _id: `card_${nextId}`,
        created: nextTimestamp,
        updated: nextTimestamp,
      };
      nextId += 1;
      nextTimestamp += 1000;
      cardsBySlug[createdCard.slug] = createdCard;

      return clone(createdCard);
    },
    async updateOne({ query, updateValues }) {
      const card = Object.values(cardsBySlug).find((candidate) => matchesQuery(candidate, query));

      if (!card) {
        return { acknowledged: true, modifiedCount: 0 };
      }

      Object.assign(card, clone(updateValues), { updated: nextTimestamp });
      nextTimestamp += 1000;

      return { acknowledged: true, modifiedCount: 1 };
    },
  };
}

async function callService(serviceFn, payload, options) {
  try {
    const data = await serviceFn(payload, options);

    return {
      status: 200,
      body: {
        status: 'success',
        data,
      },
    };
  } catch (error) {
    return {
      status: HTTP_STATUS_BY_CODE[error.errorCode] || 400,
      body: {
        status: 'error',
        message: error.message,
        code: error.errorCode,
      },
    };
  }
}

function assertNoMongoId(value) {
  assert.strictEqual(Object.hasOwn(value, '_id'), false);
  assert.strictEqual(typeof value.id, 'string');
}

// End-to-end service-level coverage for the 16 valid and invalid cases supplied
// in the assessment prompt. HTTP statuses are mapped from the template errors.
describe('creator card assessment cases', () => {
  let repository;
  const options = () => ({ repository, generateSuffix: () => 'a1b2c3' });

  beforeEach(() => {
    repository = createStatefulRepository();
  });

  it('passes all 16 valid and invalid assessment cases in sequence', async () => {
    let response;

    response = await callService(
      createCreatorCard,
      {
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
      },
      options()
    );
    assert.strictEqual(response.status, 200, 'case 1 status');
    assert.strictEqual(response.body.data.access_type, 'public', 'case 1 access_type');
    assertNoMongoId(response.body.data);

    response = await callService(
      createCreatorCard,
      {
        title: 'Ada Designs Things',
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
        status: 'published',
      },
      options()
    );
    assert.strictEqual(response.status, 200, 'case 2 status');
    assert.strictEqual(response.body.data.slug, 'ada-designs-things', 'case 2 slug');

    response = await callService(
      createCreatorCard,
      {
        title: 'VIP Rate Card',
        creator_reference: 'crt_x9y8z7w6v5u4t3s2',
        status: 'published',
        access_type: 'private',
        access_code: 'A1B2C3',
      },
      options()
    );
    assert.strictEqual(response.status, 200, 'case 3 status');
    assert.strictEqual(response.body.data.access_code, 'A1B2C3', 'case 3 access_code');

    response = await callService(retrieveCreatorCard, { slug: 'george-cooks' }, { repository });
    assert.strictEqual(response.status, 200, 'case 4 status');
    assertNoMongoId(response.body.data);
    assert.strictEqual(Object.hasOwn(response.body.data, 'access_code'), false, 'case 4 no pin');

    response = await callService(
      retrieveCreatorCard,
      { slug: 'vip-rate-card', access_code: 'A1B2C3' },
      { repository }
    );
    assert.strictEqual(response.status, 200, 'case 5 status');
    assert.strictEqual(Object.hasOwn(response.body.data, 'access_code'), false, 'case 5 no pin');

    response = await callService(
      deleteCreatorCard,
      {
        slug: 'ada-designs-things',
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
      },
      { repository, getCurrentTimestamp: () => 1767139200000 }
    );
    assert.strictEqual(response.status, 200, 'case 6 status');
    assert.strictEqual(response.body.data.slug, 'ada-designs-things', 'case 6 slug');
    assert.strictEqual(response.body.data.deleted, 1767139200000, 'case 6 deleted');
    assert.strictEqual(
      Object.hasOwn(response.body.data, 'access_code'),
      true,
      'case 6 creation shape'
    );

    response = await callService(
      createCreatorCard,
      {
        title: 'Another George',
        slug: 'george-cooks',
        creator_reference: 'crt_m1n2b3v4c5x6z7l8',
        status: 'published',
      },
      options()
    );
    assert.strictEqual(response.status, 400, 'case 7 status');
    assert.strictEqual(response.body.code, 'SL02', 'case 7 code');

    response = await callService(
      createCreatorCard,
      {
        title: 'Secret Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        access_type: 'private',
      },
      options()
    );
    assert.strictEqual(response.status, 400, 'case 8 status');
    assert.strictEqual(response.body.code, 'AC01', 'case 8 code');

    response = await callService(
      createCreatorCard,
      {
        title: 'Public Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'published',
        access_type: 'public',
        access_code: 'A1B2C3',
      },
      options()
    );
    assert.strictEqual(response.status, 400, 'case 9 status');
    assert.strictEqual(response.body.code, 'AC05', 'case 9 code');

    response = await callService(
      createCreatorCard,
      {
        title: 'Bad Status Card',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
        status: 'archived',
      },
      options()
    );
    assert.strictEqual(response.status, 400, 'case 10 status');

    response = await callService(
      retrieveCreatorCard,
      { slug: 'does-not-exist-123' },
      { repository }
    );
    assert.strictEqual(response.status, 404, 'case 11 status');
    assert.strictEqual(response.body.code, 'NF01', 'case 11 code');

    await callService(
      createCreatorCard,
      {
        title: 'My Draft Card',
        slug: 'my-draft-card',
        creator_reference: 'crt_d1r2a3f4t5c6a7r8',
        status: 'draft',
      },
      options()
    );
    response = await callService(retrieveCreatorCard, { slug: 'my-draft-card' }, { repository });
    assert.strictEqual(response.status, 404, 'case 12 status');
    assert.strictEqual(response.body.code, 'NF02', 'case 12 code');

    response = await callService(retrieveCreatorCard, { slug: 'vip-rate-card' }, { repository });
    assert.strictEqual(response.status, 403, 'case 13 status');
    assert.strictEqual(response.body.code, 'AC03', 'case 13 code');

    response = await callService(
      retrieveCreatorCard,
      { slug: 'vip-rate-card', access_code: 'WRONG1' },
      { repository }
    );
    assert.strictEqual(response.status, 403, 'case 14 status');
    assert.strictEqual(response.body.code, 'AC04', 'case 14 code');

    response = await callService(
      deleteCreatorCard,
      {
        slug: 'does-not-exist-123',
        creator_reference: 'crt_q1w2e3r4t5y6u7i8',
      },
      { repository }
    );
    assert.strictEqual(response.status, 404, 'case 15 status');
    assert.strictEqual(response.body.code, 'NF01', 'case 15 code');

    response = await callService(
      retrieveCreatorCard,
      { slug: 'ada-designs-things' },
      { repository }
    );
    assert.strictEqual(response.status, 404, 'case 16 status');
    assert.strictEqual(response.body.code, 'NF01', 'case 16 code');
  });
});
