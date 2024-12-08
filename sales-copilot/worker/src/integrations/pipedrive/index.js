const BaseIntegration = require('../baseIntegration');
const PipedriveClient = require('./client');
const { entityTypes } = require('./entityTypes');

class PipedriveIntegration extends BaseIntegration {
    createClient(integration) {
        return new PipedriveClient(
            integration.connection_settings,
            this.testMode,
            this.testLimit
        );
    }

    getEntityTypes() {
        return entityTypes;
    }
}

module.exports = PipedriveIntegration; 