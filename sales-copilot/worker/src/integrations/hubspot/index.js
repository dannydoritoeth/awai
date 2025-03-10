const HubspotClient = require('./client');
const { 
    contactDocumentCreator, 
    dealDocumentCreator, 
    engagementDocumentCreator,
    companyDocumentCreator,
    lineItemDocumentCreator
} = require('./documentCreators');
const entityTypes = require('./entityTypes');

module.exports = {
    client: HubspotClient,
    documentCreators: {
        contact: contactDocumentCreator,
        deal: dealDocumentCreator,
        engagement: engagementDocumentCreator,
        company: companyDocumentCreator,
        lineItem: lineItemDocumentCreator
    },
    entityTypes
}; 