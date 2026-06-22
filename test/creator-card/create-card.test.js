const assert = require('assert');
const createCreatorCard = require('@app/services/creator-card/create-card');

const DEFAULT_CREATED_TIMESTAMP = 1767052800000;
const DEFAULT_UPDATED_TIMESTAMP = 1767052800000;

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

function createRepositoryDouble(initialCards = {}) {
  const cardsBySlug = { ...initialCards };
  const createdCards = [];

  return {
    createdCards,
    async findOne({ query }) {
      return cardsBySlug[query.slug] || null;
    },
    async create(cardPayload) {
      const createdCard = {
        ...cardPayload,
        _id: `card_${createdCards.length + 1}`,
        created: DEFAULT_CREATED_TIMESTAMP,
        updated: DEFAULT_UPDATED_TIMESTAMP,
      };

      createdCards.push(createdCard);
      cardsBySlug[createdCard.slug] = createdCard;

      return createdCard;
    },
  };
}

function createValidPayload(overrides = {}) {
  return {
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
    ...overrides,
  };
}

describe('createCreatorCard', () => {
  it('creates a published creator card and serializes _id as id', async () => {
    const repository = createRepositoryDouble();
    const response = await createCreatorCard(createValidPayload(), { repository });

    assert.strictEqual(response.id, 'card_1');
    assert.strictEqual(response._id, undefined);
    assert.strictEqual(response.slug, 'george-cooks');
    assert.strictEqual(response.access_type, 'public');
    assert.strictEqual(response.access_code, null);
    assert.strictEqual(response.created, DEFAULT_CREATED_TIMESTAMP);
    assert.strictEqual(response.updated, DEFAULT_UPDATED_TIMESTAMP);
    assert.strictEqual(response.deleted, null);
  });

  it('auto-generates a slug from the title when slug is omitted', async () => {
    const repository = createRepositoryDouble();
    const response = await createCreatorCard(
      createValidPayload({
        title: 'Ada Designs Things',
        slug: undefined,
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
        links: undefined,
        service_rates: undefined,
      }),
      { repository }
    );

    assert.strictEqual(response.slug, 'ada-designs-things');
    assert.deepStrictEqual(response.links, []);
    assert.strictEqual(response.service_rates, null);
  });

  it('appends a suffix when an auto-generated slug is already taken', async () => {
    const repository = createRepositoryDouble({
      'ada-designs-things': { slug: 'ada-designs-things' },
    });
    const response = await createCreatorCard(
      createValidPayload({
        title: 'Ada Designs Things',
        slug: undefined,
        creator_reference: 'crt_a1b2c3d4e5f6g7h8',
      }),
      { repository, generateSuffix: () => 'a1b2c3' }
    );

    assert.strictEqual(response.slug, 'ada-designs-things-a1b2c3');
  });

  it('rejects a client-provided duplicate slug with SL02', async () => {
    const repository = createRepositoryDouble({
      'george-cooks': { slug: 'george-cooks' },
    });

    await assertRejectsWithCode(
      () => createCreatorCard(createValidPayload(), { repository }),
      'SL02'
    );
  });

  it('requires access_code for private cards with AC01', async () => {
    const repository = createRepositoryDouble();

    await assertRejectsWithCode(
      () =>
        createCreatorCard(
          createValidPayload({
            access_type: 'private',
          }),
          { repository }
        ),
      'AC01'
    );
  });

  it('rejects access_code on public cards with AC05', async () => {
    const repository = createRepositoryDouble();

    await assertRejectsWithCode(
      () =>
        createCreatorCard(
          createValidPayload({
            access_type: 'public',
            access_code: 'A1B2C3',
          }),
          { repository }
        ),
      'AC05'
    );
  });

  it('returns access_code when creating a private card', async () => {
    const repository = createRepositoryDouble();
    const response = await createCreatorCard(
      createValidPayload({
        title: 'VIP Rate Card',
        slug: 'vip-rate-card',
        access_type: 'private',
        access_code: 'A1B2C3',
      }),
      { repository }
    );

    assert.strictEqual(response.access_type, 'private');
    assert.strictEqual(response.access_code, 'A1B2C3');
  });
});
