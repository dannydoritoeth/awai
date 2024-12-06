const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone } = require('@pinecone-database/pinecone');
const { Document } = require("@langchain/core/documents");

// Define logging levels
const LOG_LEVELS = {
    ERROR: 0,   // Only errors
    INFO: 1,    // Basic info + errors
    DEBUG: 2    // Detailed info + basic info + errors
};

class LangchainPineconeService {
    constructor(apiKey, embeddingService, logLevel = LOG_LEVELS.INFO) {
        const client = new Pinecone({
            apiKey: apiKey
        });

        this.embeddings = embeddingService;
        this.pineconeIndex = client.Index("sales-copilot");
        this.logLevel = logLevel;
    }

    log(level, message, data = null) {
        if (level <= this.logLevel) {
            switch (level) {
                case LOG_LEVELS.ERROR:
                    console.error(message, data || '');
                    break;
                case LOG_LEVELS.INFO:
                    console.log(message, data ? `(${JSON.stringify(data)})` : '');
                    break;
                case LOG_LEVELS.DEBUG:
                    console.log('DEBUG:', message, data || '');
                    break;
            }
        }
    }

    async addDocuments(vectors, namespace) {
        this.log(LOG_LEVELS.INFO, `Processing ${vectors.length} vectors for namespace ${namespace}`);
        
        this.log(LOG_LEVELS.DEBUG, 'Vector sample:', {
            id: vectors[0].id,
            type: vectors[0].metadata.type,
            hasEmbedding: !!vectors[0].values
        });

        // Convert vectors to documents
        const docs = vectors.map(vector => {
            try {
                const originalData = JSON.parse(vector.metadata.rawData);
                let pageContent;

                // Use the appropriate text creation method based on type
                switch (vector.metadata.type) {
                    case 'deal':
                        pageContent = this.createDealText(originalData);
                        break;
                    case 'lead':
                        pageContent = this.createLeadText(originalData);
                        break;
                    case 'person':
                        pageContent = this.createPersonText(originalData);
                        break;
                    case 'organization':
                        pageContent = this.createOrganizationText(originalData);
                        break;
                    case 'note':
                        pageContent = this.createNoteText(originalData);
                        break;
                    case 'activity':
                        pageContent = this.createActivityText(originalData);
                        break;
                    default:
                        pageContent = this.createTextFromMetadata(vector.metadata);
                }

                return new Document({ 
                    pageContent, 
                    metadata: vector.metadata 
                });
            } catch (error) {
                this.log(LOG_LEVELS.ERROR, 'Error processing vector:', { 
                    id: vector.id, 
                    type: vector.metadata.type,
                    error: error.message 
                });
                throw error;
            }
        });

        this.log(LOG_LEVELS.DEBUG, 'Sample document:', {
            pageContent: docs[0].pageContent.substring(0, 100) + '...',
            type: docs[0].metadata.type
        });

        try {
            this.log(LOG_LEVELS.INFO, 'Storing documents in Pinecone');
            const vectorStore = await PineconeStore.fromDocuments(docs, this.embeddings, {
                pineconeIndex: this.pineconeIndex,
                namespace: namespace,
            });
            
            this.log(LOG_LEVELS.INFO, `Successfully stored ${docs.length} documents`);
            return vectorStore;
        } catch (error) {
            this.log(LOG_LEVELS.ERROR, 'Failed to store documents:', error);
            throw error;
        }
    }

    // Text creation functions copied from PipedriveIntegration
    createDealText(deal) {
        const parts = [
            // Common fields
            `Type: deal`,
            `Source: pipedrive`,
            `Customer ID: ${deal.customer_id}`,
            `Customer Name: ${deal.customer_name}`,

            // Deal specific fields
            `Deal ID: ${deal.id}`,
            `Title: ${deal.title || ''}`,
            `Value: ${deal.value || 0} ${deal.currency || ''}`,
            `Status: ${deal.status || ''}`,
            `Stage: ${deal.stage_id || ''}`,
            
            // Relationships
            `Organization ID: ${deal.org_id?.value || deal.org_id || ''}`,
            `Organization Name: ${deal.org_name || ''}`,
            `Person ID: ${deal.person_id?.value || deal.person_id || ''}`,
            `Person Name: ${deal.person_name || ''}`,
            `Owner ID: ${deal.owner_id?.value || deal.owner_id || ''}`,
            
            // Dates
            `Expected Close Date: ${deal.expected_close_date || ''}`,
            `Add Time: ${deal.add_time || ''}`,
            `Update Time: ${deal.update_time || ''}`,
            `Close Time: ${deal.close_time || ''}`,
            
            // Additional fields
            `Lost Reason: ${deal.lost_reason || ''}`,
            `Visible To: ${deal.visible_to || ''}`,
            `Active: ${deal.active ? 'Yes' : 'No'}`
        ];

        return parts
            .filter(part => part && !part.endsWith(': ') && !part.endsWith(': Unknown'))
            .join('\n');
    }

    createPersonText(person) {
        const parts = [
            `Name: ${person.name || ''}`,
            person.title ? `Title: ${person.title}` : null,
            person.org_name ? `Organization: ${person.org_name}` : null,
            person.email ? `Email: ${this.formatEmails(person.email)}` : null,
            person.phone ? `Phone: ${this.formatPhones(person.phone)}` : null,
            Array.isArray(person.labels) && person.labels.length > 0 ? `Labels: ${person.labels.join(', ')}` : null,
            `Deals: ${person.open_deals_count || 0} open, ${person.won_deals_count || 0} won, ${person.lost_deals_count || 0} lost`,
            person.last_activity_date ? `Last Activity: ${person.last_activity_date}` : null,
            person.next_activity_date ? `Next Activity: ${person.next_activity_date}` : null
        ];
        return parts.filter(part => part).join('\n');
    }

    createOrganizationText(org) {
        const parts = [
            `Name: ${org.name || ''}`,
            org.address ? `Address: ${[
                org.address,
                org.address_sublocality,
                org.address_locality,
                org.address_postal_code,
                org.address_country
            ].filter(Boolean).join(', ')}` : null,
            org.email ? `Email: ${Array.isArray(org.email) ? org.email.map(e => e.value).join(', ') : org.email}` : null,
            org.phone ? `Phone: ${Array.isArray(org.phone) ? org.phone.map(p => p.value).join(', ') : org.phone}` : null,
            org.web_domain ? `Website: ${org.web_domain}` : null,
            Array.isArray(org.labels) && org.labels.length > 0 ? `Labels: ${org.labels.join(', ')}` : null,
            `Deals: ${org.open_deals_count || 0} open, ${org.won_deals_count || 0} won, ${org.lost_deals_count || 0} lost`,
            org.last_activity_date ? `Last Activity: ${org.last_activity_date}` : null,
            org.next_activity_date ? `Next Activity: ${org.next_activity_date}` : null
        ];
        return parts.filter(part => part).join('\n');
    }

    createNoteText(note) {
        const parts = [
            note.content ? `Content: ${note.content}` : null,
            note.deal_id ? `Deal ID: ${note.deal_id}` : null,
            note.person_id ? `Person ID: ${note.person_id}` : null,
            note.org_id ? `Organization ID: ${note.org_id}` : null,
            note.lead_id ? `Lead ID: ${note.lead_id}` : null,
            note.pinned_to_deal_flag ? 'Pinned to Deal' : null,
            note.pinned_to_organization_flag ? 'Pinned to Organization' : null,
            note.pinned_to_person_flag ? 'Pinned to Person' : null
        ];
        return parts.filter(part => part).join('\n');
    }

    createActivityText(activity) {
        const parts = [
            `Subject: ${activity.subject || ''}`,
            `Type: ${activity.type || ''}`,
            `Due: ${activity.due_date || ''} ${activity.due_time || ''}`,
            `Status: ${activity.done ? 'Done' : 'Active'}`,
            activity.note ? `Note: ${activity.note}` : null,
            activity.public_description ? `Description: ${activity.public_description}` : null,
            activity.location ? `Location: ${activity.location}` : null
        ];
        return parts.filter(part => part).join('\n');
    }

    createLeadText(lead) {
        const parts = [
            // Common fields
            `Type: lead`,
            `Source: ${lead.source_name || 'Unknown'}`,
            `Customer ID: ${lead.customer_id}`,
            `Customer Name: ${lead.customer_name}`,

            // Lead specific fields
            `Title: ${lead.title || ''}`,
            `Lead ID: ${lead.id}`,
            `Value: ${lead.value?.amount || 0} ${lead.value?.currency || ''}`,
            `Status: ${lead.status || 'Unknown'}`,
            
            // Relationships
            `Organization ID: ${lead.organization_id?.value || lead.organization_id || ''}`,
            `Organization Name: ${lead.organization_name || 'Unknown'}`,
            `Person ID: ${lead.person_id?.value || lead.person_id || ''}`,
            `Person Name: ${lead.person_name || 'Unknown'}`,
            `Owner ID: ${lead.owner_id?.value || lead.owner_id || ''}`,
            
            // Dates
            `Expected Close Date: ${lead.expected_close_date || ''}`,
            `Add Time: ${lead.add_time || ''}`,
            `Update Time: ${lead.update_time || ''}`,
            
            // Additional fields
            `Labels: ${Array.isArray(lead.label_ids) ? lead.label_ids.join(', ') : ''}`,
            `Notes: ${lead.note || ''}`,
            `Visible To: ${lead.visible_to || ''}`,
            `Is Archived: ${lead.is_archived ? 'Yes' : 'No'}`,
            `Origin: ${lead.origin || ''}`,
            `Channel: ${lead.channel || ''}`,
            `Was Seen: ${lead.was_seen ? 'Yes' : 'No'}`,
            `CC Email: ${lead.cc_email || ''}`
        ];

        return parts
            .filter(part => part && !part.endsWith(': ') && !part.endsWith(': Unknown') && !part.endsWith(': 0 '))
            .join('\n');
    }

    formatEmails(emails) {
        if (!emails) return '';
        if (Array.isArray(emails)) {
            return emails.map(e => e.value).join(', ');
        }
        return emails;
    }

    formatPhones(phones) {
        if (!phones) return '';
        if (Array.isArray(phones)) {
            return phones.map(p => p.value).join(', ');
        }
        return phones;
    }

    // Fallback text creation from metadata
    createTextFromMetadata(metadata) {
        return Object.entries(metadata)
            .filter(([key, value]) => {
                if (key === 'rawData') return false;
                if (value === undefined || value === null || value === '') return false;
                return true;
            })
            .map(([key, value]) => {
                const label = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .trim();
                return `${label}: ${value}`;
            })
            .join('\n');
    }
}

// Export both the class and logging levels
module.exports = {
    LangchainPineconeService,
    LOG_LEVELS
}; 