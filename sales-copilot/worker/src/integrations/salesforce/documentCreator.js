const BaseDocumentCreator = require('../baseDocumentCreator');

class SalesforceDocumentCreator extends BaseDocumentCreator {
    static getSource() {
        return 'salesforce';
    }
    
    // Implement specific createText methods...
}

module.exports = SalesforceDocumentCreator; 