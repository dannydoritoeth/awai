const { types: entityTypes } = require('./entityTypes');

function createBaseDocument(entity, type) {
    return {
        id: entity.id,
        type,
        createdAt: entity.createdAt || new Date().toISOString(),
        metadata: {
            ...entity
        }
    };
}

const contactDocumentCreator = (contact) => {
    const doc = createBaseDocument(contact, entityTypes.CONTACT);
    
    // Create searchable content from contact fields
    const content = [
        `Contact: ${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        contact.email ? `Email: ${contact.email}` : '',
        contact.phone ? `Phone: ${contact.phone}` : '',
        contact.lifecycleStage ? `Lifecycle Stage: ${contact.lifecycleStage}` : '',
        contact.leadStatus ? `Lead Status: ${contact.leadStatus}` : ''
    ].filter(Boolean).join('\n');

    return {
        ...doc,
        content,
        embeddings: {
            text: content,
            fields: {
                name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
                email: contact.email || '',
                phone: contact.phone || '',
                lifecycleStage: contact.lifecycleStage || '',
                leadStatus: contact.leadStatus || ''
            }
        }
    };
};

const dealDocumentCreator = (deal) => {
    const doc = createBaseDocument(deal, entityTypes.DEAL);
    
    // Create searchable content from deal fields
    const content = [
        `Deal: ${deal.name}`,
        `Stage: ${deal.dealStage}`,
        deal.amount ? `Amount: ${deal.amount}` : '',
        deal.closeDate ? `Close Date: ${deal.closeDate}` : '',
        `Pipeline: ${deal.pipeline}`,
        deal.lastActivityDate ? `Last Activity: ${deal.lastActivityDate}` : ''
    ].filter(Boolean).join('\n');

    return {
        ...doc,
        content,
        embeddings: {
            text: content,
            fields: {
                name: deal.name,
                stage: deal.dealStage,
                amount: deal.amount?.toString() || '',
                pipeline: deal.pipeline,
                closeDate: deal.closeDate || ''
            }
        }
    };
};

const engagementDocumentCreator = (engagement) => {
    const doc = createBaseDocument(engagement, entityTypes.ENGAGEMENT);
    
    // Create searchable content from engagement fields
    const content = [
        `Engagement Type: ${engagement.type}`,
        engagement.source ? `Source: ${engagement.source}` : '',
        `Timestamp: ${engagement.timestamp}`,
        engagement.message ? `Message: ${engagement.message}` : ''
    ].filter(Boolean).join('\n');

    return {
        ...doc,
        content,
        embeddings: {
            text: content,
            fields: {
                type: engagement.type,
                source: engagement.source || '',
                message: engagement.message || ''
            }
        }
    };
};

const companyDocumentCreator = (company) => {
    const doc = createBaseDocument(company, entityTypes.COMPANY);
    
    // Create searchable content from company fields
    const content = [
        `Company: ${company.name}`,
        company.domain ? `Domain: ${company.domain}` : '',
        company.industry ? `Industry: ${company.industry}` : '',
        company.type ? `Type: ${company.type}` : '',
        company.phone ? `Phone: ${company.phone}` : '',
        company.lifecycleStage ? `Lifecycle Stage: ${company.lifecycleStage}` : '',
        [
            company.city,
            company.state,
            company.country
        ].filter(Boolean).join(', ')
    ].filter(Boolean).join('\n');

    return {
        ...doc,
        content,
        embeddings: {
            text: content,
            fields: {
                name: company.name,
                domain: company.domain || '',
                industry: company.industry || '',
                type: company.type || '',
                location: [company.city, company.state, company.country].filter(Boolean).join(', '),
                lifecycleStage: company.lifecycleStage || ''
            }
        }
    };
};

const lineItemDocumentCreator = (lineItem) => {
    const doc = createBaseDocument(lineItem, entityTypes.LINE_ITEM);
    
    // Create searchable content from line item fields
    const content = [
        `Item: ${lineItem.name}`,
        lineItem.sku ? `SKU: ${lineItem.sku}` : '',
        lineItem.description ? `Description: ${lineItem.description}` : '',
        `Quantity: ${lineItem.quantity}`,
        `Price: ${lineItem.price}`,
        lineItem.tax ? `Tax: ${lineItem.tax}` : '',
        `Deal ID: ${lineItem.dealId}`
    ].filter(Boolean).join('\n');

    return {
        ...doc,
        content,
        embeddings: {
            text: content,
            fields: {
                name: lineItem.name,
                sku: lineItem.sku || '',
                description: lineItem.description || '',
                dealId: lineItem.dealId,
                price: lineItem.price.toString()
            }
        }
    };
};

module.exports = {
    contactDocumentCreator,
    dealDocumentCreator,
    engagementDocumentCreator,
    companyDocumentCreator,
    lineItemDocumentCreator
}; 