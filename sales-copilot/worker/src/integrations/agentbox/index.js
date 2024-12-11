const { BaseIntegration } = require('../baseIntegration');
const { 
    EnquiryDocumentCreator, 
    ProspectiveBuyerDocumentCreator,
    ListingDocumentCreator,
    ContactDocumentCreator,
    SearchRequirementDocumentCreator 
} = require('./documentCreator');

class AgentboxIntegration extends BaseIntegration {
    constructor(client, vectorStore) {
        super(client, vectorStore);
        this.enquiryDocumentCreator = new EnquiryDocumentCreator();
        this.prospectiveBuyerDocumentCreator = new ProspectiveBuyerDocumentCreator();
        this.listingDocumentCreator = new ListingDocumentCreator();
        this.contactDocumentCreator = new ContactDocumentCreator();
        this.searchRequirementDocumentCreator = new SearchRequirementDocumentCreator();
    }

    async processEnquiries() {
        const records = await this.client.getEnquiries();
        const documents = await this.enquiryDocumentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} enquiries`);
        return documents;
    }

    async processProspectiveBuyers() {
        const records = await this.client.getProspectiveBuyers();
        const documents = await this.prospectiveBuyerDocumentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} prospective buyers`);
        return documents;
    }

    async processListings() {
        const records = await this.client.getListings();
        const documents = await this.listingDocumentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} listings`);
        return documents;
    }

    async processContacts() {
        const records = await this.client.getContacts();
        const documents = await this.contactDocumentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} contacts`);
        return documents;
    }

    async processSearchRequirements() {
        const records = await this.client.getSearchRequirements();
        const documents = await this.searchRequirementDocumentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} search requirements`);
        return documents;
    }

    async processAll() {
        // Process all data types in a logical order
        await this.processContacts();           // First load contact data
        await this.processListings();           // Then load property data
        await this.processSearchRequirements(); // Then load search preferences
        await this.processEnquiries();          // Then load enquiries
        await this.processProspectiveBuyers();  // Finally load buyer data
        // ... rest of existing processAll code ...
    }
}

module.exports = AgentboxIntegration; 