const { Document } = require("@langchain/core/documents");

class PipedriveDocumentCreator {
    static createDocument(entity, type, metadata) {
        const pageContent = this.createText(entity, type);
        return new Document({
            pageContent,
            metadata: {
                ...metadata,
                type,
                source: 'pipedrive'
            }
        });
    }

    static createText(entity, type) {
        switch (type) {
            case 'deal':
                return this.createDealText(entity);
            case 'lead':
                return this.createLeadText(entity);
            case 'person':
                return this.createPersonText(entity);
            case 'organization':
                return this.createOrganizationText(entity);
            case 'note':
                return this.createNoteText(entity);
            case 'activity':
                return this.createActivityText(entity);
            default:
                throw new Error(`Unknown entity type: ${type}`);
        }
    }

    // Move all the createXText methods here...
    static createDealText(deal) {
        const parts = [
            `Title: ${deal.title}`,
            `Value: ${deal.value} ${deal.currency}`,
            // ... rest of deal text creation
        ];
        return parts.filter(Boolean).join('\n');
    }

    // ... other text creation methods
}

module.exports = PipedriveDocumentCreator; 