class SalesforceIntegration {
    async processLeadConversions() {
        const records = await this.client.getLeadConversionHistory();
        const documentCreator = new LeadConversionDocumentCreator();
        const documents = await documentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} lead conversion records`);
        return documents;
    }

    async processLeadScores() {
        const records = await this.client.getLeadScoreHistory();
        const documentCreator = new LeadScoreDocumentCreator();
        const documents = await documentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} lead score records`);
        return documents;
    }

    async processOpportunityHistory() {
        const records = await this.client.getOpportunityHistory();
        const documentCreator = new OpportunityHistoryDocumentCreator();
        const documents = await documentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} opportunity history records`);
        return documents;
    }

    async processCampaignInfluence() {
        const records = await this.client.getCampaignInfluence();
        const documentCreator = new CampaignInfluenceDocumentCreator();
        const documents = await documentCreator.createDocuments(records);
        await this.vectorStore.addDocuments(documents);
        console.log(`Processed ${documents.length} campaign influence records`);
        return documents;
    }

    async processAll() {
        // ... existing processAll code ...
        await this.processLeadConversions();
        await this.processLeadScores();
        await this.processOpportunityHistory();
        await this.processCampaignInfluence();
        // ... rest of existing processAll code ...
    }
} 