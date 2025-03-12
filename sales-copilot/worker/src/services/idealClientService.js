const { OpenAIEmbeddings } = require("@langchain/openai");
const { PineconeStore } = require("@langchain/pinecone");
const { Document } = require("@langchain/core/documents");
const Logger = require('./logger');

// Initialize logger
const logger = new Logger();

class IdealClientService {
    constructor() {
        this.vectorStore = null;
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-ada-002"
        });
    }

    setVectorStore(vectorStore) {
        this.vectorStore = vectorStore;
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
        const validTypes = ['contacts', 'companies'];
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
            await this.vectorStore.addDocuments([document]);

            return {
                stored: true,
                type,
                label,
                id: data.id,
                vectorId: document.metadata.vectorId
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
            this.createCompanyContent(data);

        // Create metadata
        const metadata = {
            type,
            label, // 'ideal' or 'less_ideal'
            source_id: data.id,
            created_at: new Date().toISOString(),
            vectorId: `${type}_${data.id}_${label}`,
            // Type-specific metadata
            ...(type === 'contacts' ? {
                email_domain: data.email?.split('@')[1] || '',
                industry: data.company?.industry || '',
                lifecycle_stage: data.lifecycleStage || '',
                engagement_score: this.calculateEngagementScore(data),
                deal_success_rate: this.calculateDealSuccessRate(data)
            } : {
                domain: data.domain || '',
                industry: data.industry || '',
                company_type: data.type || '',
                total_revenue: data.metrics?.totalRevenue || 0,
                deal_success_rate: this.calculateCompanyDealRate(data)
            })
        };

        return new Document({
            pageContent: content,
            metadata
        });
    }

    createContactContent(contact) {
        return `
            Contact Profile:
            Name: ${contact.firstName || ''} ${contact.lastName || ''}
            Company: ${contact.company?.name || 'Unknown'}
            Industry: ${contact.company?.industry || 'Unknown'}
            
            Engagement History:
            Total Interactions: ${contact.engagementMetrics?.totalEngagements || 0}
            Email Opens: ${contact.engagementMetrics?.emailsOpened || 0}
            Meetings Attended: ${contact.engagementMetrics?.meetingsAttended || 0}
            
            Deal History:
            Total Deals: ${contact.dealHistory?.totalDeals || 0}
            Won Deals: ${contact.dealHistory?.wonDeals || 0}
            Average Deal Size: ${contact.dealHistory?.averageDealSize || 0}
            
            Key Metrics:
            Lifecycle Stage: ${contact.lifecycleStage || 'Unknown'}
            Lead Status: ${contact.leadStatus || 'Unknown'}
            Last Activity: ${contact.engagementMetrics?.lastEngagementDate || 'Unknown'}
        `.trim();
    }

    createCompanyContent(company) {
        return `
            Company Profile:
            Name: ${company.name || 'Unknown'}
            Industry: ${company.industry || 'Unknown'}
            Type: ${company.type || 'Unknown'}
            Location: ${[company.city, company.state, company.country].filter(Boolean).join(', ')}
            
            Business Metrics:
            Total Revenue: ${company.metrics?.totalRevenue || 0}
            Total Deals: ${company.metrics?.dealCount || 0}
            Won Deals: ${company.metrics?.wonDeals || 0}
            Average Deal Size: ${company.metrics?.averageDealSize || 0}
            
            Engagement:
            Total Contacts: ${company.metrics?.contactCount || 0}
            Active Contacts: ${company.metrics?.activeContactCount || 0}
            Recent Activities: ${company.recentActivity?.length || 0}
        `.trim();
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
            const data = await hubspotClient.getDetailedIdealAndLessIdealData(type);
            
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
        
        return type === 'contacts' ?
            `${metadata.industry} contact with ${metadata.engagement_score} engagement score and ${metadata.deal_success_rate}% deal success rate` :
            `${metadata.industry} company with ${metadata.total_revenue} revenue and ${metadata.deal_success_rate}% deal success rate`;
    }

    // Helper methods for calculating metrics
    calculateEngagementScore(contact) {
        if (!contact.engagementMetrics) return 0;
        
        const weights = {
            emailsOpened: 1,
            emailsReplied: 2,
            meetingsAttended: 3,
            callsAnswered: 2
        };

        let totalScore = 0;
        let totalWeight = 0;

        Object.entries(weights).forEach(([metric, weight]) => {
            if (contact.engagementMetrics[metric]) {
                totalScore += contact.engagementMetrics[metric] * weight;
                totalWeight += weight;
            }
        });

        return totalWeight > 0 ? totalScore / totalWeight : 0;
    }

    calculateDealSuccessRate(contact) {
        if (!contact.dealHistory?.totalDeals) return 0;
        return (contact.dealHistory.wonDeals / contact.dealHistory.totalDeals) * 100;
    }

    calculateCompanyDealRate(company) {
        if (!company.metrics?.dealCount) return 0;
        return (company.metrics.wonDeals / company.metrics.dealCount) * 100;
    }
}

module.exports = new IdealClientService(); 