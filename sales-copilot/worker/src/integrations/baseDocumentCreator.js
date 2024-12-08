const { Document } = require("@langchain/core/documents");

class BaseDocumentCreator {
    static createDocument(entity, type, metadata) {
        const pageContent = this.createText(entity, type);
        return new Document({
            pageContent,
            metadata: {
                ...metadata,
                type,
                source: this.getSource()
            }
        });
    }

    static createText(entity, type) {
        throw new Error('createText must be implemented by subclass');
    }

    static getSource() {
        throw new Error('getSource must be implemented by subclass');
    }

    static formatAddress(address) {
        if (!address) return '';
        const parts = [
            address.street || address.streetAddress,
            address.city || address.suburb,
            address.state,
            address.postalCode || address.postcode,
            address.country
        ];
        return parts.filter(Boolean).join(', ');
    }

    static formatName(firstName, lastName) {
        return [firstName, lastName].filter(Boolean).join(' ');
    }
}

module.exports = BaseDocumentCreator; 