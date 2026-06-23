const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creator_cards';

// Persistence schema for Creator Cards. Request validation lives in services;
// this layer handles Mongo defaults, indexes, and uniqueness guarantees.
const schemaConfig = {
  _id: { type: SchemaTypes.ULID, required: true },
  title: { type: SchemaTypes.String, required: true },
  description: { type: SchemaTypes.String },
  // Public lookup key. The unique index is the final guard against duplicates.
  slug: { type: SchemaTypes.String, required: true, unique: true, index: true },
  creator_reference: { type: SchemaTypes.String, required: true, index: true },
  links: {
    type: [
      {
        _id: false,
        title: { type: SchemaTypes.String, required: true },
        url: { type: SchemaTypes.String, required: true },
      },
    ],
    default: [],
  },
  service_rates: {
    currency: { type: SchemaTypes.String },
    rates: [
      {
        _id: false,
        name: { type: SchemaTypes.String, required: true },
        description: { type: SchemaTypes.String },
        amount: { type: SchemaTypes.Number, required: true },
      },
    ],
  },
  status: { type: SchemaTypes.String, required: true, index: true },
  access_type: { type: SchemaTypes.String, required: true },
  // Stored only for private cards and removed from public retrieval responses.
  access_code: { type: SchemaTypes.String, default: null },
  created: { type: SchemaTypes.Number, required: true },
  updated: { type: SchemaTypes.Number, required: true },
  // Soft-delete marker. Active cards keep null so reads can filter deleted cards.
  deleted: { type: SchemaTypes.Number, default: null },
};

const modelSchema = new ModelSchema(schemaConfig, { collection: modelName });

module.exports = DatabaseModel.model(modelName, modelSchema);
