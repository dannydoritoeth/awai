const { OpenAIEmbeddings } = require("@langchain/openai");
const { PineconeStore } = require("@langchain/pinecone");
const { Document } = require("@langchain/core/documents");
const Logger = require('./logger');

// Initialize logger
const logger = new Logger();

class IdealClientService {
    constructor() {
        this.vectorStore = null;
        this.namespace = null;
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-ada-002"
        });
    }

    setVectorStore(vectorStore, namespace) {
        this.vectorStore = vectorStore;
        this.namespace = namespace;
    }

    // Validate label values
    validateLabel(label) {
        const validLabels = ['ideal', 'less_ideal'];
        if (!validLabels.includes(label.toLowerCase())) {
            throw new Error(`Invalid label: ${label}. Must be one of: ${validLabels.join(', ')}`);
        }
        return label.toLowerCase();
    }

    // Validate type values
    validateType(type) {
        const validTypes = ['contacts', 'companies', 'deals'];
        if (!validTypes.includes(type.toLowerCase())) {
            throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
        }
        return type.toLowerCase();
    }

    async storeIdealClientData(data, type, label) {
        try {
            // Validate inputs
            type = this.validateType(type);
            label = this.validateLabel(label);

            const document = await this.createDocument(data, type, label);
            await this.vectorStore.addDocuments([document], { namespace: this.namespace });

            return {
                stored: true,
                type,
                label,
                id: data.id,
                vectorId: document.metadata.vectorId,
                namespace: this.namespace
            };
        } catch (error) {
            logger.error('Error storing ideal client data:', error);
            throw error;
        }
    }

    async createDocument(data, type, label) {
        // Create text content based on type
        const content = type === 'contacts' ? 
            this.createContactContent(data) : 
            type === 'companies' ?
            this.createCompanyContent(data) :
            this.createDealContent(data);

        // Create metadata
        const metadata = {
            type,
            label, // 'ideal' or 'less_ideal'
            source_id: data.id,
            created_at: new Date().toISOString(),
            vectorId: `${type}_${data.id}_${label}`,
            // Type-specific metadata
            ...(this.createTypeSpecificMetadata(data, type))
        };

        return new Document({
            pageContent: content,
            metadata
        });
    }

    createTypeSpecificMetadata(data, type) {
        switch(type) {
            case 'contacts':
                return {
                    email_domain: data.properties?.email?.split('@')[1] || '',
                    industry: data.enriched?.companies?.[0]?.properties?.industry || '',
                    lifecycle_stage: data.properties?.lifecyclestage || '',
                    job_title: data.properties?.jobtitle || '',
                    has_company: data.enriched?.companies?.length > 0,
                    has_deals: data.enriched?.deals?.length > 0,
                    deal_count: data.enriched?.deals?.length || 0,
                    company_count: data.enriched?.companies?.length || 0,
                    related_company_ids: data.enriched?.companies?.map(c => c.id) || [],
                    related_deal_ids: data.enriched?.deals?.map(d => d.id) || []
                };
            case 'companies':
                return {
                    domain: data.properties?.domain || '',
                    industry: data.properties?.industry || '',
                    company_type: data.properties?.type || '',
                    company_size: data.properties?.numberofemployees || '',
                    annual_revenue: data.properties?.annualrevenue || '',
                    contact_count: data.enriched?.contacts?.length || 0,
                    deal_count: data.enriched?.deals?.length || 0,
                    total_revenue: data.enriched?.metrics?.totalRevenue || 0,
                    related_contact_ids: data.enriched?.contacts?.map(c => c.id) || [],
                    related_deal_ids: data.enriched?.deals?.map(d => d.id) || []
                };
            case 'deals':
                return {
                    deal_stage: data.properties?.dealstage || '',
                    deal_type: data.properties?.dealtype || '',
                    amount: data.properties?.amount || '',
                    pipeline: data.properties?.pipeline || '',
                    sales_cycle_days: data.enriched?.metrics?.salesCycleDays || '',
                    contact_count: data.enriched?.contacts?.length || 0,
                    company_count: data.enriched?.companies?.length || 0,
                    line_item_count: data.enriched?.lineItems?.length || 0,
                    related_contact_ids: data.enriched?.contacts?.map(c => c.id) || [],
                    related_company_ids: data.enriched?.companies?.map(c => c.id) || []
                };
            default:
                return {};
        }
    }

    createContactContent(contact) {
        // Base contact information
        let content = `
        Contact Profile:
        Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}
        Job Title: ${contact.properties?.jobtitle || 'Unknown'}
        Email: ${contact.properties?.email || 'Unknown'}
        Lifecycle Stage: ${contact.properties?.lifecyclestage || 'Unknown'}
        Lead Status: ${contact.properties?.hs_lead_status || 'Unknown'}
        `.trim();
        
        // Add company information if available
        if (contact.enriched?.companies?.length > 0) {
            const company = contact.enriched.companies[0];
            content += `\n\nCompany Information:
            Company: ${company.properties?.name || 'Unknown'}
            Industry: ${company.properties?.industry || 'Unknown'}
            Size: ${company.properties?.numberofemployees || 'Unknown'} employees
            Revenue: ${company.properties?.annualrevenue || 'Unknown'}
            Type: ${company.properties?.type || 'Unknown'}
            `.trim();
        }
        
        // Add deal information if available
        if (contact.enriched?.deals?.length > 0) {
            content += '\n\nDeal History:';
            contact.enriched.deals.forEach((deal, index) => {
                content += `
                Deal ${index + 1}:
                Name: ${deal.properties?.dealname || 'Unknown'}
                Stage: ${deal.properties?.dealstage || 'Unknown'}
                Amount: ${deal.properties?.amount || 'Unknown'}
                Type: ${deal.properties?.dealtype || 'Unknown'}
                `.trim();
            });
        }
        
        return content;
    }

    createCompanyContent(company) {
        // Base company information
        let content = `
        Company Profile:
        Name: ${company.properties?.name || 'Unknown'}
        Industry: ${company.properties?.industry || 'Unknown'}
        Type: ${company.properties?.type || 'Unknown'}
        Size: ${company.properties?.numberofemployees || 'Unknown'} employees
        Revenue: ${company.properties?.annualrevenue || 'Unknown'}
        Location: ${[company.properties?.city, company.properties?.state, company.properties?.country].filter(Boolean).join(', ')}
        Description: ${company.properties?.description || 'No description available'}
        `.trim();
        
        // Add key contacts if available
        if (company.enriched?.contacts?.length > 0) {
            content += '\n\nKey Contacts:';
            company.enriched.contacts.slice(0, 5).forEach((contact, index) => {
                content += `
                Contact ${index + 1}:
                Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}
                Title: ${contact.properties?.jobtitle || 'Unknown'}
                Status: ${contact.properties?.hs_lead_status || 'Unknown'}
                `.trim();
            });
        }
        
        // Add deal information if available
        if (company.enriched?.deals?.length > 0) {
            content += '\n\nDeal History:';
            company.enriched.deals.forEach((deal, index) => {
                content += `
                Deal ${index + 1}:
                Name: ${deal.properties?.dealname || 'Unknown'}
                Stage: ${deal.properties?.dealstage || 'Unknown'}
                Amount: ${deal.properties?.amount || 'Unknown'}
                Type: ${deal.properties?.dealtype || 'Unknown'}
                `.trim();
            });
        }
        
        // Add metrics
        if (company.enriched?.metrics) {
            const metrics = company.enriched.metrics;
            content += `\n\nBusiness Metrics:
            Total Revenue: ${metrics.totalRevenue || 0}
            Total Deals: ${metrics.totalDeals || 0}
            Won Deals: ${metrics.wonDeals || 0}
            Active Contacts: ${metrics.activeContacts || 0}
            `.trim();
        }
        
        return content;
    }

    createDealContent(deal) {
        // Base deal information
        let content = `
        Deal Profile:
        Name: ${deal.properties?.dealname || 'Unknown'}
        Stage: ${deal.properties?.dealstage || 'Unknown'}
        Amount: ${deal.properties?.amount || 'Unknown'}
        Type: ${deal.properties?.dealtype || 'Unknown'}
        Pipeline: ${deal.properties?.pipeline || 'Unknown'}
        Priority: ${deal.properties?.hs_priority || 'Unknown'}
        Description: ${deal.properties?.description || 'No description available'}
        Created: ${deal.properties?.createdate || 'Unknown'}
        Closed: ${deal.properties?.closedate || 'Not closed'}
        `.trim();
        
        // Add company information if available
        if (deal.enriched?.companies?.length > 0) {
            const company = deal.enriched.companies[0];
            content += `\n\nCompany Information:
            Company: ${company.properties?.name || 'Unknown'}
            Industry: ${company.properties?.industry || 'Unknown'}
            Size: ${company.properties?.numberofemployees || 'Unknown'} employees
            Revenue: ${company.properties?.annualrevenue || 'Unknown'}
            `.trim();
        }
        
        // Add contact information if available
        if (deal.enriched?.contacts?.length > 0) {
            content += '\n\nKey Contacts:';
            deal.enriched.contacts.slice(0, 3).forEach((contact, index) => {
                content += `
                Contact ${index + 1}:
                Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}
                Title: ${contact.properties?.jobtitle || 'Unknown'}
                Status: ${contact.properties?.hs_lead_status || 'Unknown'}
                `.trim();
            });
        }
        
        // Add line items if available
        if (deal.enriched?.lineItems?.length > 0) {
            content += '\n\nProducts/Services:';
            deal.enriched.lineItems.forEach((item, index) => {
                content += `
                Item ${index + 1}:
                Name: ${item.properties?.name || 'Unknown'}
                Quantity: ${item.properties?.quantity || '1'}
                Price: ${item.properties?.price || 'Unknown'}
                Description: ${item.properties?.description || 'No description'}
                `.trim();
            });
        }
        
        // Add metrics
        if (deal.enriched?.metrics) {
            const metrics = deal.enriched.metrics;
            content += `\n\nDeal Metrics:
            Total Value: ${metrics.totalValue || 0}
            Sales Cycle: ${metrics.salesCycleDays || 'Unknown'} days
            Contact Count: ${metrics.contactCount || 0}
            Line Item Count: ${metrics.lineItemCount || 0}
            `.trim();
        }
        
        return content;
    }

    // Helper method to store multiple clients
    async storeBatchIdealClientData(clients, type) {
        const results = {
            ideal: [],
            less_ideal: [],
            errors: []
        };

        for (const client of clients) {
            try {
                // Determine if this is an ideal or less-ideal client based on the list name
                const label = client.sourceList?.toLowerCase().includes('less-ideal') ? 
                    'less_ideal' : 'ideal';

                const result = await this.storeIdealClientData(client, type, label);
                results[label].push(result);
            } catch (error) {
                results.errors.push({
                    id: client.id,
                    error: error.message
                });
            }
        }

        return {
            ...results,
            summary: {
                total: clients.length,
                ideal: results.ideal.length,
                lessIdeal: results.less_ideal.length,
                failed: results.errors.length
            }
        };
    }

    async findSimilarClients(query, type, limit = 5) {
        try {
            type = this.validateType(type);
            
            const queryDoc = await this.createDocument(query, type, 'query');
            
            const results = await this.vectorStore.similaritySearch(
                queryDoc.pageContent,
                limit,
                { type }
            );

            return results.map(result => ({
                score: result.score,
                metadata: result.metadata,
                content: result.pageContent
            }));
        } catch (error) {
            logger.error('Error finding similar clients:', error);
            throw error;
        }
    }

    async analyzeClientFit(query, type) {
        try {
            type = this.validateType(type);

            const similar = await this.findSimilarClients(query, type, 10);
            
            // Calculate fit score based on similar examples
            const idealCount = similar.filter(x => x.metadata.label === 'ideal').length;
            const lessIdealCount = similar.filter(x => x.metadata.label === 'less_ideal').length;
            const totalCount = idealCount + lessIdealCount;
            
            // Avoid division by zero
            const score = totalCount > 0 ? (idealCount / totalCount) * 100 : 50;

            // Group similar clients
            const idealExamples = similar
                .filter(x => x.metadata.label === 'ideal')
                .slice(0, 3);
            const lessIdealExamples = similar
                .filter(x => x.metadata.label === 'less_ideal')
                .slice(0, 3);

            return {
                score,
                classification: this.getClassification(score),
                analysis: this.generateAnalysis(score, idealExamples, lessIdealExamples),
                similarClients: {
                    ideal: idealExamples,
                    lessIdeal: lessIdealExamples
                },
                metrics: {
                    totalSimilar: similar.length,
                    idealCount,
                    lessIdealCount
                }
            };
        } catch (error) {
            logger.error('Error analyzing client fit:', error);
            throw error;
        }
    }

    // Example usage method
    async processHubSpotLists(hubspotClient, type = 'contacts') {
        try {
            type = this.validateType(type);
            
            // Get data from both lists
            const data = await hubspotClient.getIdealAndLessIdealData(type);
            
            // Process ideal clients
            const idealResults = await Promise.all(
                data.ideal.map(client => 
                    this.storeIdealClientData(client, type, 'ideal')
                )
            );

            // Process less-ideal clients
            const lessIdealResults = await Promise.all(
                data.lessIdeal.map(client => 
                    this.storeIdealClientData(client, type, 'less_ideal')
                )
            );

            return {
                success: true,
                type,
                summary: {
                    ideal: {
                        processed: idealResults.length,
                        successful: idealResults.filter(r => r.stored).length
                    },
                    lessIdeal: {
                        processed: lessIdealResults.length,
                        successful: lessIdealResults.filter(r => r.stored).length
                    }
                },
                details: {
                    ideal: idealResults,
                    lessIdeal: lessIdealResults
                }
            };
        } catch (error) {
            logger.error('Error processing HubSpot lists:', error);
            throw error;
        }
    }

    getClassification(score) {
        if (score >= 80) return 'Strongly Ideal';
        if (score >= 60) return 'Moderately Ideal';
        if (score >= 40) return 'Neutral';
        if (score >= 20) return 'Moderately Less-Ideal';
        return 'Strongly Less-Ideal';
    }

    generateAnalysis(score, idealExamples, lessIdealExamples) {
        let analysis = `Client fit score: ${score.toFixed(1)}%\n\n`;

        if (idealExamples.length > 0) {
            analysis += "Similar to ideal clients in:\n";
            analysis += idealExamples
                .map(ex => `- ${this.extractKeyCharacteristics(ex)}`)
                .join('\n');
        }

        if (lessIdealExamples.length > 0) {
            analysis += "\n\nPotential concerns (similar to less ideal clients):\n";
            analysis += lessIdealExamples
                .map(ex => `- ${this.extractKeyCharacteristics(ex)}`)
                .join('\n');
        }

        return analysis;
    }

    extractKeyCharacteristics(example) {
        const metadata = example.metadata;
        const type = metadata.type;
        
        if (type === 'contacts') {
            return `${metadata.industry || 'Unknown industry'} contact with ${metadata.job_title || 'Unknown role'}, ${metadata.deal_count || 0} deals`;
        } else if (type === 'companies') {
            return `${metadata.industry || 'Unknown industry'} company with ${metadata.company_size || 'Unknown size'}, ${metadata.total_revenue || 0} revenue`;
        } else if (type === 'deals') {
            return `${metadata.deal_type || 'Unknown type'} deal worth ${metadata.amount || 'Unknown amount'}, ${metadata.deal_stage || 'Unknown stage'} stage`;
        }
        
        return 'Unknown characteristics';
    }

    async scoreNewLead(leadData) {
        try {
            // Create a query document from the lead
            const queryDoc = await this.createDocument(leadData, 'contacts', 'query');
            
            // Search for similar ideal clients
            const results = await this.vectorStore.similaritySearch(
                queryDoc.pageContent,
                10,
                { namespace: this.namespace }
            );
            
            // Extract the most relevant context
            const context = results.map(result => ({
                content: result.pageContent,
                metadata: result.metadata,
                score: result.score
            }));
            
            // Use the context for AI scoring
            return this.generateAIScore(leadData, context);
        } catch (error) {
            logger.error('Error scoring new lead:', error);
            throw error;
        }
    }

    async generateAIScore(leadData, context) {
        try {
            // Format the context for the AI
            const formattedContext = context.map(item => 
                `--- ${item.metadata.label.toUpperCase()} ${item.metadata.type.toUpperCase()} EXAMPLE ---\n${item.content}`
            ).join('\n\n');
            
            // Create the prompt
            const prompt = `
            You are analyzing a new lead to determine how well they match with ideal client profiles.
            
            NEW LEAD INFORMATION:
            ${this.createContactContent(leadData)}
            
            SIMILAR EXAMPLES FROM OUR DATABASE:
            ${formattedContext}
            
            Based on the above information, please:
            1. Score this lead from 0-100 on how well they match our ideal client profile
            2. Explain the key factors that influenced your score
            3. Identify any potential red flags or opportunities
            4. Recommend next steps for engaging with this lead
            
            Format your response as JSON with the following structure:
            {
              "score": number,
              "explanation": string,
              "keyFactors": string[],
              "redFlags": string[],
              "opportunities": string[],
              "nextSteps": string[]
            }
            `;
            
            // Call the AI with the prompt
            // This is a placeholder - you'll need to implement the actual AI call
            const response = await this.callAI(prompt);
            
            // Parse and return the result
            return JSON.parse(response);
        } catch (error) {
            logger.error('Error generating AI score:', error);
            throw error;
        }
    }

    // Placeholder for AI call - implement with your preferred AI service
    async callAI(prompt) {
        // This is a placeholder - replace with actual implementation
        logger.info('AI prompt:', prompt);
        return JSON.stringify({
            score: 75,
            explanation: "This is a placeholder score. Implement actual AI scoring.",
            keyFactors: ["Placeholder factor 1", "Placeholder factor 2"],
            redFlags: ["Placeholder red flag"],
            opportunities: ["Placeholder opportunity"],
            nextSteps: ["Placeholder next step"]
        });
    }
}

module.exports = new IdealClientService(); 