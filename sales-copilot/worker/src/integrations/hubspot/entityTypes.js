const CONTACT = 'hubspot_contact';
const DEAL = 'hubspot_deal';
const ENGAGEMENT = 'hubspot_engagement';
const COMPANY = 'hubspot_company';
const LINE_ITEM = 'hubspot_line_item';

const entityTypes = {
    CONTACT,
    DEAL,
    ENGAGEMENT,
    COMPANY,
    LINE_ITEM
};

const entitySchemas = {
    [CONTACT]: {
        properties: {
            id: { type: 'string', required: true },
            email: { type: 'string', required: false },
            firstName: { type: 'string', required: false },
            lastName: { type: 'string', required: false },
            phone: { type: 'string', required: false },
            lifecycleStage: { type: 'string', required: false },
            leadStatus: { type: 'string', required: false },
            createdAt: { type: 'string', required: true },
            updatedAt: { type: 'string', required: true }
        },
        indexes: ['email', 'phone', 'firstName', 'lastName']
    },
    [DEAL]: {
        properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            dealStage: { type: 'string', required: true },
            amount: { type: 'number', required: false },
            closeDate: { type: 'string', required: false },
            pipeline: { type: 'string', required: true },
            lastActivityDate: { type: 'string', required: false },
            createdAt: { type: 'string', required: true }
        },
        indexes: ['name', 'dealStage', 'pipeline']
    },
    [ENGAGEMENT]: {
        properties: {
            id: { type: 'string', required: true },
            type: { type: 'string', required: true },
            source: { type: 'string', required: false },
            sourceId: { type: 'string', required: false },
            timestamp: { type: 'string', required: true },
            message: { type: 'string', required: false }
        },
        indexes: ['type', 'source']
    },
    [COMPANY]: {
        properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            domain: { type: 'string', required: false },
            industry: { type: 'string', required: false },
            type: { type: 'string', required: false },
            city: { type: 'string', required: false },
            state: { type: 'string', required: false },
            country: { type: 'string', required: false },
            phone: { type: 'string', required: false },
            lifecycleStage: { type: 'string', required: false },
            createdAt: { type: 'string', required: true },
            updatedAt: { type: 'string', required: true }
        },
        indexes: ['name', 'domain', 'industry', 'type']
    },
    [LINE_ITEM]: {
        properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            quantity: { type: 'number', required: true },
            price: { type: 'number', required: true },
            dealId: { type: 'string', required: true },
            sku: { type: 'string', required: false },
            description: { type: 'string', required: false },
            tax: { type: 'number', required: false },
            createdAt: { type: 'string', required: true },
            updatedAt: { type: 'string', required: true }
        },
        indexes: ['name', 'sku', 'dealId']
    }
};

const entityValidators = {
    [CONTACT]: (data) => {
        const schema = entitySchemas[CONTACT];
        return validateEntity(data, schema);
    },
    [DEAL]: (data) => {
        const schema = entitySchemas[DEAL];
        return validateEntity(data, schema);
    },
    [ENGAGEMENT]: (data) => {
        const schema = entitySchemas[ENGAGEMENT];
        return validateEntity(data, schema);
    },
    [COMPANY]: (data) => {
        const schema = entitySchemas[COMPANY];
        return validateEntity(data, schema);
    },
    [LINE_ITEM]: (data) => {
        const schema = entitySchemas[LINE_ITEM];
        return validateEntity(data, schema);
    }
};

function validateEntity(data, schema) {
    const errors = [];
    const properties = schema.properties;

    for (const [key, config] of Object.entries(properties)) {
        if (config.required && !data[key]) {
            errors.push(`Missing required field: ${key}`);
        }

        if (data[key] && typeof data[key] !== config.type) {
            errors.push(`Invalid type for ${key}: expected ${config.type}, got ${typeof data[key]}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    types: entityTypes,
    schemas: entitySchemas,
    validators: entityValidators
}; 