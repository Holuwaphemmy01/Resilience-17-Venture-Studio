const repositoryFactory = require('@app-core/repository-factory');

// Thin data-access module. Services can inject a fake repository for unit tests,
// while production still uses the Mongo-backed template repository factory.
module.exports = repositoryFactory('CreatorCard');
