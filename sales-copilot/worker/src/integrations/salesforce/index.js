const BaseIntegration = require('../baseIntegration');
const SalesforceClient = require('./client');
const { entityTypes } = require('./entityTypes');

class SalesforceIntegration extends BaseIntegration {
    createClient(integration) {
        return new SalesforceClient(
            integration.connection_settings,
            this.testMode,
            this.testLimit
        );
    }

    getEntityTypes() {
        return entityTypes;
    }
}

module.exports = SalesforceIntegration; 