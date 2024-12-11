class BaseMetadataCreator {
    static createBaseMetadata(entity, integration, type) {
        return {
            customerId: integration.customer_id.toString(),
            customerName: integration.customer_name,
            entityId: entity.id || entity.Id,
            type,
            source: this.getSource(),
            createdDate: this.getCreatedDate(entity),
            lastModifiedDate: this.getModifiedDate(entity)
        };
    }

    static getSource() {
        throw new Error('getSource must be implemented by subclass');
    }

    static getCreatedDate(entity) {
        // Handle different date field names across integrations
        return entity.CreatedDate || entity.add_time || entity.firstCreated;
    }

    static getModifiedDate(entity) {
        // Handle different date field names across integrations
        return entity.LastModifiedDate || entity.update_time || entity.lastModified;
    }
}

module.exports = BaseMetadataCreator; 