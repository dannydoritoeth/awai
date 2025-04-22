import { HubspotClient } from './hubspotClient.ts';
import { Logger } from './logger.ts';
import { AIConfig, HubspotAccount } from './types.ts';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { SubscriptionService } from "./subscriptionService.ts";
import { PineconeClient } from './pineconeClient.ts';
import { handleApiCall } from './apiHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface ScoringResult {
  score: number;
  summary: string;
  lastScored: string;
}

interface AIResponse {
  score: number;
  positives: string[];
  negatives: string[];
  summary: string;
}

// Interface for similar deals 
interface SimilarDeal {
  record: any;
  similarity: number;
  existingScore: {
    score: string | number;
    summary: string;
    lastScored: string;
    derivedScore?: number;
    classification?: string;
  } | null;
}

export class ScoringService {
  private hubspotClient: HubspotClient;
  private logger: Logger;
  private aiConfig: AIConfig;
  private portalId: string;
  private openai: OpenAI;
  private pineconeClient: PineconeClient;
  private subscriptionService: SubscriptionService;
  private refreshToken?: string;

  constructor(
    hubspotClient: HubspotClient,
    aiConfig: AIConfig,
    portalId: string,
    logger: Logger,
    refreshToken?: string
  ) {
    this.hubspotClient = hubspotClient;
    this.aiConfig = aiConfig;
    this.portalId = portalId;
    this.logger = logger;
    this.refreshToken = refreshToken;

    // Initialize services
    this.openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    });

    // Use our custom PineconeClient instead of direct SDK
    this.pineconeClient = new PineconeClient();
    this.pineconeClient.initialize(
      Deno.env.get('PINECONE_API_KEY')!,
      Deno.env.get('PINECONE_INDEX') || 'sales-copilot'
    );

    // Initialize subscription service with Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.subscriptionService = new SubscriptionService(supabaseUrl, supabaseKey);
  }

  private async getEmbeddings(record: any): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: JSON.stringify(record),
        model: 'text-embedding-3-large'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  }

  private async getSimilarRecords(record: any, type: 'contact' | 'company' | 'deal'): Promise<any[]> {
    try {
      // Get embeddings for the current record
      const embedding = await this.getEmbeddings(record);
      
      // Query Pinecone using the correct namespace format
      const namespace = `hubspot-${this.portalId}`;
      const queryResponse = await this.pineconeClient.query(
        namespace,
        embedding,
        {
          portalId: this.portalId,
          recordType: type
        },
        5
      );

      return queryResponse.matches.map(match => match.metadata);
    } catch (error) {
      this.logger.error(`Error getting similar ${type}s:`, error);
      return []; // Return empty array if similarity search fails
    }
  }

  private async getAIResponse(prompt: string, data: any, similarRecords: any[] = []): Promise<{ score: number; summary: string; fullPrompt: string }> {
    const { provider, model, temperature, maxTokens, scoringPrompt } = this.aiConfig;
    
    const defaultPrompt = `You are an expert at analyzing sales and CRM data to determine how well a deal aligns with an ideal client profile.

Your task is to review the provided record (including metadata, related contact and company info, and past engagement), and output a structured evaluation in the following format:

Return a JSON object with the following fields:
- score: number from 0 to 100 (whole number only)
- positives: array of 1–3 short bullets identifying positive signals
- negatives: array of 1–3 short bullets identifying risk factors or missing data
- summary: 3–5 sentence executive summary explaining the score and reasoning behind it in plain language

Example format:
{
  "score": 88,
  "positives": [
    "Deal Amount is $98,698 — well-aligned with high-value ideal clients",
    "Deal Stage is qualified to buy — strong buying intent",
    "Similar Closed Deals scored 90/100 with values between $27,063 and $95,074"
  ],
  "negatives": [
    "Missing Company Info — industry, size, and revenue not provided",
    "Missing Contact Details — no title, seniority, or engagement data"
  ],
  "summary": "This deal scores 88/100 based on its similarity to high-value, high-conversion deals in your historical dataset. The financial fit is strong, and the deal stage indicates readiness to purchase. However, the absence of detailed company and contact metadata slightly lowers confidence in full alignment with your ideal client profile. Still, based on monetary potential and sales progression alone, this is a high-potential opportunity."
}

Important:
- Be concise and focused in each section.
- Use dollar formatting for deal values.
- Avoid repeating the same points in both positives and summary.
- Tailor the analysis to the record's data and similarity results from the Pinecone index.

`;

    // Construct the full prompt with similar records context
    const fullPrompt = `${scoringPrompt || defaultPrompt}

${similarRecords.length > 0 ? `Similar records for context:
${JSON.stringify(similarRecords, null, 2)}

` : ''}Record to analyze:
${JSON.stringify(data, null, 2)}`;

    try {
      let response: AIResponse;
      
      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(model, fullPrompt, temperature, maxTokens);
          break;
        case 'anthropic':
          response = await this.callAnthropic(model, fullPrompt, temperature, maxTokens);
          break;
        case 'google':
          response = await this.callGoogle(model, fullPrompt, temperature, maxTokens);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      // Format the summary to include positives and negatives
      const formattedSummary = this.formatSummaryFromResponse(response);

      // Return the score and formatted summary
      return { 
        score: response.score, 
        summary: formattedSummary,
        fullPrompt 
      };
    } catch (error) {
      this.logger.error('Error getting AI response:', error);
      throw error;
    }
  }

  private async callOpenAI(model: string, prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  private async callAnthropic(model: string, prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.content[0].text);
  }

  private async callGoogle(model: string, prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/${model}:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GOOGLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  }

  private formatSummaryFromResponse(response: AIResponse): string {
    // Format exactly as shown in UI
    const positivesList = response.positives.length > 0 ? '✓ Top Positives\n' + response.positives.map(p => `- ${p}`).join('\n') : '';
    const negativesList = response.negatives.length > 0 ? '\n\n⚠ Top Negatives\n' + response.negatives.map(n => `- ${n}`).join('\n') : '';
    const execSummary = '\n\n📋 Executive Summary\n' + response.summary;
    
    return `${positivesList}${negativesList}${execSummary}`;
  }

  private async checkScoringLimit(): Promise<void> {
    try {
    const { canScore, remaining, periodEnd } = await this.subscriptionService.canScoreLead(this.portalId);
      
      // Validate the remaining value
      const remainingScores = Number.isNaN(remaining) ? 0 : remaining;
      
    if (!canScore) {
        // Safely format the date or provide a fallback
        let periodEndText = "the end of the current period";
        try {
          if (periodEnd && periodEnd instanceof Date && !isNaN(periodEnd.getTime())) {
            periodEndText = periodEnd.toISOString();
          }
        } catch (dateError) {
          this.logger.warn('Invalid date format in period end:', dateError);
        }
        
        throw new Error(`Scoring limit reached. You have used all ${remainingScores} scores for this period. Next reset at ${periodEndText}`);
      }
    } catch (error) {
      // Catch and log any errors from the subscription service
      if (error.message && error.message.includes('Invalid time value')) {
        this.logger.error('Error checking scoring limit - invalid date:', error);
        throw new Error('Unable to check scoring limits due to a date formatting issue. Please contact support.');
      }
      
      // Add specific handling for NaN error
      if (error.message && error.message.includes('NaN scores')) {
        this.logger.error('Error with score count calculation:', error);
        throw new Error('Unable to calculate remaining scores. Please contact support.');
      }
      
      throw error;
    }
  }

  private async recordScoreUsage(
    recordId: string,
    recordType: 'contact' | 'company' | 'deal',
    inputs: any,
    outputs: any
  ): Promise<void> {
    // Calculate processing duration if needed
    await this.subscriptionService.recordScore(this.portalId, {
      recordId,
      recordType,
      inputs,
      outputs,
      aiProvider: this.aiConfig.provider,
      aiModel: this.aiConfig.model
    });
  }

  async scoreContact(contactId: string): Promise<ScoringResult> {
    await this.checkScoringLimit();
    this.logger.info(`Scoring contact ${contactId}`);
    
    try {
      let contact;
      if (this.refreshToken) {
        contact = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getContact(contactId)
        );
      } else {
        contact = await this.hubspotClient.getContact(contactId);
      }
      
      let similarContacts;
      if (this.refreshToken) {
        similarContacts = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.getSimilarRecords(contact, 'contact')
        );
      } else {
        similarContacts = await this.getSimilarRecords(contact, 'contact');
      }
      
      // Prepare inputs for logging
      const inputs = {
        contact,
        similarContacts,
        aiConfig: { ...this.aiConfig }
      };
      
      const result = await this.getAIResponse('Score this contact', contact, similarContacts);
      const lastScored = new Date().toISOString();

      // Update the contact in HubSpot
      if (this.refreshToken) {
        await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.updateContact(contactId, {
            ideal_client_score: result.score.toString(),
            ideal_client_summary: result.summary,
            ideal_client_last_scored: lastScored
          })
        );
      } else {
      await this.hubspotClient.updateContact(contactId, {
        ideal_client_score: result.score.toString(),
        ideal_client_summary: result.summary,
        ideal_client_last_scored: lastScored
      });
      }

      // Prepare outputs for logging
      const outputs = {
        score: result.score,
        summary: result.summary,
        lastScored,
        // Include the full prompt that was sent to the AI
        fullPrompt: result.fullPrompt
      };

      await this.recordScoreUsage(contactId, 'contact', inputs, outputs);
      
      // Don't include fullPrompt in the return value to the client
      return { score: result.score, summary: result.summary, lastScored };
    } catch (error) {
      this.logger.error('Error scoring contact:', error);
      throw error;
    }
  }

  async scoreCompany(companyId: string): Promise<ScoringResult> {
    await this.checkScoringLimit();
    this.logger.info(`Scoring company ${companyId}`);
    
    try {
      let company;
      if (this.refreshToken) {
        company = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getCompany(companyId)
        );
      } else {
        company = await this.hubspotClient.getCompany(companyId);
      }
      
      let similarCompanies;
      if (this.refreshToken) {
        similarCompanies = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.getSimilarRecords(company, 'company')
        );
      } else {
        similarCompanies = await this.getSimilarRecords(company, 'company');
      }
      
      // Prepare inputs for logging
      const inputs = {
        company,
        similarCompanies,
        aiConfig: { ...this.aiConfig }
      };
      
      const result = await this.getAIResponse('Score this company', company, similarCompanies);
      const lastScored = new Date().toISOString();

      // Update the company in HubSpot
      if (this.refreshToken) {
        await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.updateCompany(companyId, {
            ideal_client_score: result.score.toString(),
            ideal_client_summary: result.summary,
            ideal_client_last_scored: lastScored
          })
        );
      } else {
      await this.hubspotClient.updateCompany(companyId, {
        ideal_client_score: result.score.toString(),
        ideal_client_summary: result.summary,
        ideal_client_last_scored: lastScored
      });
      }

      // Prepare outputs for logging
      const outputs = {
        score: result.score,
        summary: result.summary,
        lastScored,
        fullPrompt: result.fullPrompt
      };

      await this.recordScoreUsage(companyId, 'company', inputs, outputs);
      
      // Don't include fullPrompt in the return value to the client
      return { score: result.score, summary: result.summary, lastScored };
    } catch (error) {
      this.logger.error('Error scoring company:', error);
      throw error;
    }
  }

  /**
   * Derive a score for a deal based on its value and how it compares to
   * the ideal/nonideal metrics stored in the hubspot_accounts table
   * @param dealValue The deal amount
   * @param classification 'ideal' or 'nonideal'
   * @param metrics Object containing high, low, median values
   * @returns A score between 0-100
   */
  private derivedScore(
    dealValue: number,
    classification: string,
    metrics: {
      ideal_high: number;
      ideal_low: number;
      ideal_median: number;
      nonideal_high: number;
      nonideal_low: number;
      nonideal_median: number;
    }
  ): number {
    // Return default scores if no deal value
    if (!dealValue || dealValue <= 0) {
      return classification === 'ideal' ? 90 : 30;
    }

    if (classification === 'ideal') {
      // For ideal deals, score between 80-100
      const { ideal_high, ideal_low, ideal_median } = metrics;
      
      // If we don't have ideal metrics yet
      if (ideal_low === null || ideal_high === null || ideal_median === null) {
        return 90; // Default ideal score
      }

      // Calculate how close the deal value is to the median
      // Closer to median = higher score
      const range = Math.max(ideal_high - ideal_low, 1); // Avoid division by zero
      const distanceFromMedian = Math.abs(dealValue - ideal_median);
      const normalizedDistance = Math.min(distanceFromMedian / range, 1);
      
      // Score between 80-100, with 100 being at the median
      // and decreasing as we move away from the median
      return 100 - (normalizedDistance * 20);
    } else {
      // For nonideal deals, score between 0-50
      const { nonideal_high, nonideal_low, nonideal_median } = metrics;
      
      // If we don't have nonideal metrics yet
      if (nonideal_low === null || nonideal_high === null || nonideal_median === null) {
        return 30; // Default nonideal score
      }

      // Calculate how close the deal value is to the median
      // Closer to median = lower score (for nonideal)
      const range = Math.max(nonideal_high - nonideal_low, 1); // Avoid division by zero
      const distanceFromMedian = Math.abs(dealValue - nonideal_median);
      const normalizedDistance = Math.min(distanceFromMedian / range, 1);
      
      // Score between 0-50, with 0 being at the median
      // and increasing as we move away from the median
      return normalizedDistance * 50;
    }
  }

  async scoreDeal(dealId: string): Promise<ScoringResult> {
    await this.checkScoringLimit();
    this.logger.info(`Starting scoring process for deal ${dealId}`);
    
    try {
      // 1. Fetch the deal with all properties
      this.logger.info(`Fetching deal ${dealId} from HubSpot`);
      let deal;
      if (this.refreshToken) {
        deal = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getDeal(dealId)
        );
      } else {
        deal = await this.hubspotClient.getDeal(dealId);
      }
      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }
      this.logger.info(`Successfully retrieved deal ${dealId}`);
      
      // 2. Fetch associated contacts and companies for the deal
      this.logger.info(`Fetching associations for deal ${dealId}`);
      let associationsData;
      if (this.refreshToken) {
        associationsData = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getDealAssociations(dealId)
        );
      } else {
        associationsData = await this.hubspotClient.getDealAssociations(dealId);
      }
      this.logger.info(`Retrieved associations data:`, JSON.stringify(associationsData));
      
      // 3. Process contacts
      const contacts: any[] = [];
      if (associationsData.results && associationsData.results.contacts) {
        this.logger.info(`Found ${associationsData.results.contacts.length} associated contacts`);
        
        // Load details for each associated contact
        const contactResults = await Promise.all(
          associationsData.results.contacts.map(async (association: any) => {
            try {
              this.logger.info(`Fetching contact ${association.id}`);
              let contact;
              if (this.refreshToken) {
                contact = await handleApiCall(
                  this.hubspotClient,
                  this.portalId,
                  this.refreshToken,
                  () => this.hubspotClient.getContact(association.id)
                );
              } else {
                contact = await this.hubspotClient.getContact(association.id);
              }
              return contact;
            } catch (error) {
              this.logger.warn(`Failed to fetch associated contact ${association.id}:`, error);
              return null;
            }
          })
        );
        const validContacts = contactResults.filter(contact => contact !== null);
        this.logger.info(`Successfully retrieved ${validContacts.length} contacts`);
        validContacts.forEach(contact => contacts.push(contact));
      } else {
        this.logger.info(`No contacts associated with deal ${dealId}`);
      }
      
      // 4. Process companies
      const companies: any[] = [];
      if (associationsData.results && associationsData.results.companies) {
        this.logger.info(`Found ${associationsData.results.companies.length} associated companies`);
        
        // Load details for each associated company
        const companyResults = await Promise.all(
          associationsData.results.companies.map(async (association: any) => {
            try {
              this.logger.info(`Fetching company ${association.id}`);
              let company;
              if (this.refreshToken) {
                company = await handleApiCall(
                  this.hubspotClient,
                  this.portalId,
                  this.refreshToken,
                  () => this.hubspotClient.getCompany(association.id)
                );
              } else {
                company = await this.hubspotClient.getCompany(association.id);
              }
              return company;
            } catch (error) {
              this.logger.warn(`Failed to fetch associated company ${association.id}:`, error);
              return null;
            }
          })
        );
        const validCompanies = companyResults.filter(company => company !== null);
        this.logger.info(`Successfully retrieved ${validCompanies.length} companies`);
        validCompanies.forEach(company => companies.push(company));
      } else {
        this.logger.info(`No companies associated with deal ${dealId}`);
      }
      
      // 5. Package the complete document with all related entities
      const completeRecord = {
        deal,
        contacts,
        companies
      };
      
      // 6. Get embeddings for the current record
      this.logger.info(`Generating embeddings for deal ${dealId}`);
      let embedding;
      try {
        embedding = await this.getEmbeddings(completeRecord);
        this.logger.info(`Successfully generated embeddings with length ${embedding.length}`);
      } catch (embeddingError) {
        this.logger.error(`Error generating embeddings:`, embeddingError);
        this.logger.info(`Proceeding without embeddings to still allow scoring`);
        embedding = [];
      }
      
      // 7. Find similar deals in Pinecone
      const similarDeals: SimilarDeal[] = [];
      if (embedding && embedding.length > 0) {
        this.logger.info(`Searching for similar deals in Pinecone namespace: hubspot-${this.portalId}`);
        try {
          // Create a detailed filter based on what we know about the deal
          const filter = {
            portalId: this.portalId,
            recordType: 'deal'
          };
          
          const namespace = `hubspot-${this.portalId}`;
          this.logger.info(`Pinecone query params: namespace=${namespace}, filter=${JSON.stringify(filter)}`);
          
          const similarDealsResponse = await this.pineconeClient.query(
            namespace,
            embedding,
            filter,
            10,  // Increase from 5 to 10 to get more potential matches
            0.01  // Set minimum similarity threshold very low to get results even if not very similar
          );
          
          this.logger.info(`Pinecone query returned ${similarDealsResponse.matches?.length || 0} matches`);
          
          // 8. Get metrics from hubspot_accounts table
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          const { data: accountMetrics } = await supabase
            .from('hubspot_accounts')
            .select(`
              ideal_high,
              ideal_low,
              ideal_median,
              nonideal_high,
              nonideal_low,
              nonideal_median
            `)
            .eq('portal_id', this.portalId)
            .single();
            
          const metrics = accountMetrics || {
            ideal_high: null,
            ideal_low: null,
            ideal_median: null,
            nonideal_high: null,
            nonideal_low: null,
            nonideal_median: null
          };
          
          this.logger.info(`Account metrics: ${JSON.stringify(metrics)}`);
          
          // 9. Process similar deals to include their scores and other relevant information
          if (similarDealsResponse.matches && similarDealsResponse.matches.length > 0) {
            for (const match of similarDealsResponse.matches) {
              try {
                // Skip the current deal if it somehow appears in the results
                if (match.id === dealId) continue;
                
                const matchId = match.id;
                this.logger.info(`Processing similar deal ${matchId} with similarity ${match.score}`);
                
                // Default for existingScore
                let existingScore = null;
                
                // Check if we have existing score in metadata
                if (match.metadata) {
                  // Get deal value from metadata
                  const dealValue = parseFloat(match.metadata.deal_value) || 0;
                  const classification = match.metadata.classification || 'unknown';
                  
                  // Calculate derived score based on metrics
                  const score = this.derivedScore(dealValue, classification, metrics);
                  
                  this.logger.info(`Deal ${matchId} has value ${dealValue}, classification ${classification}, derived score ${score}`);
                  
                  // If we have ideal_client_score in metadata, use that
                  if (match.metadata.ideal_client_score) {
                    existingScore = {
                      score: match.metadata.ideal_client_score,
                      summary: match.metadata.ideal_client_summary || 'No summary available',
                      lastScored: match.metadata.ideal_client_last_scored || 'Unknown',
                      derivedScore: score,
                      classification: classification
                    };
                  } else {
                    // If no existing score, use derived score
                    existingScore = {
                      score: score,
                      summary: `Derived score based on ${classification} deal value of ${dealValue}`,
                      lastScored: 'N/A',
                      derivedScore: score,
                      classification: classification
                    };
                  }
                }
                
                // If no score yet, try to fetch from HubSpot
                if (!existingScore) {
                  // If not in metadata, try to fetch from HubSpot
                  this.logger.info(`Fetching deal ${matchId} from HubSpot to get score`);
                  try {
                    let matchDeal;
                    if (this.refreshToken) {
                      matchDeal = await handleApiCall(
                        this.hubspotClient,
                        this.portalId,
                        this.refreshToken,
                        () => this.hubspotClient.getDeal(matchId)
                      );
                    } else {
                      matchDeal = await this.hubspotClient.getDeal(matchId);
                    }
                    
                    if (matchDeal.properties && matchDeal.properties.ideal_client_score) {
                      this.logger.info(`Found score in HubSpot: ${matchDeal.properties.ideal_client_score}`);
                      
                      // Get deal value from properties
                      const dealValue = parseFloat(matchDeal.properties.amount) || 0;
                      const classification = matchDeal.properties.training_classification || 'unknown';
                      
                      // Calculate derived score
                      const score = this.derivedScore(dealValue, classification, metrics);
                      
                      existingScore = {
                        score: matchDeal.properties.ideal_client_score,
                        summary: matchDeal.properties.ideal_client_summary || 'No summary available',
                        lastScored: matchDeal.properties.ideal_client_last_scored || 'Unknown',
                        derivedScore: score,
                        classification: classification
                      };
                    } else {
                      this.logger.info(`No score found for deal ${matchId}`);
                    }
                  } catch (fetchError) {
                    this.logger.warn(`Failed to fetch similar deal ${matchId} from HubSpot:`, fetchError);
                  }
                }
                
                // Add the full document with score information to the similar deals list
                similarDeals.push({
                  record: match.metadata || {},
                  similarity: match.score || 0,
                  existingScore
                });
                this.logger.info(`Added deal ${matchId} to similar deals list`);
              } catch (error) {
                this.logger.warn(`Failed to process similar deal:`, error);
              }
            }
          } else {
            this.logger.info(`No similar deals found in Pinecone, proceeding with empty similarDeals array`);
          }
        } catch (pineconeError) {
          this.logger.error(`Error querying Pinecone:`, pineconeError);
          this.logger.info(`Proceeding without similar deals to still allow scoring`);
        }
      } else {
        this.logger.warn(`No embeddings available to search for similar deals`);
      }
      
      this.logger.info(`Found ${similarDeals.length} similar deals for comparison`);
      
      // 10. Prepare inputs for logging
      const inputs = {
        completeRecord,
        similarDeals,
        aiConfig: { ...this.aiConfig }
      };
      
      // 11. Build a comprehensive prompt and get AI response
      this.logger.info(`Generating AI prompt for scoring deal ${dealId}`);
      const result = await this.getEnhancedAIResponse(completeRecord, similarDeals);
      const lastScored = new Date().toISOString();
      this.logger.info(`AI returned score: ${result.score}/100`);

      // 12. Update the deal in HubSpot
      this.logger.info(`Updating deal ${dealId} in HubSpot with score ${result.score}`);
      if (this.refreshToken) {
        await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.updateDeal(dealId, {
            ideal_client_score: result.score.toString(),
            ideal_client_summary: result.summary,
            ideal_client_last_scored: lastScored
          })
        );
      } else {
      await this.hubspotClient.updateDeal(dealId, {
        ideal_client_score: result.score.toString(),
        ideal_client_summary: result.summary,
        ideal_client_last_scored: lastScored
      });
      }
      this.logger.info(`Successfully updated deal ${dealId} in HubSpot`);

      // 13. Prepare outputs for logging
      const outputs = {
        score: result.score,
        summary: result.summary,
        lastScored,
        fullPrompt: result.fullPrompt
      };

      // 14. Log the scoring event
      this.logger.info(`Recording score usage for deal ${dealId}`);
      await this.recordScoreUsage(dealId, 'deal', inputs, outputs);
      this.logger.info(`Successfully completed scoring for deal ${dealId}`);
      
      // Return the result (without the full prompt)
      return { score: result.score, summary: result.summary, lastScored };
    } catch (error) {
      this.logger.error(`Error scoring deal ${dealId}:`, error);
      throw error;
    }
  }
  
  private async getEnhancedAIResponse(
    completeRecord: any,
    similarDeals: SimilarDeal[]
  ): Promise<{ score: number; summary: string; fullPrompt: string }> {
    const { provider, model, temperature, maxTokens, scoringPrompt } = this.aiConfig;
    
    // Log complete record for debugging - with PII redaction
    const redactedRecord = this.redactPII(JSON.parse(JSON.stringify(completeRecord)));
    this.logger.info('Complete record for AI analysis:', JSON.stringify(redactedRecord, null, 2).substring(0, 1000) + '...');
    this.logger.info('Similar deals count:', similarDeals.length);
    if (similarDeals.length > 0) {
      const redactedSimilarDeal = this.redactPII(JSON.parse(JSON.stringify(similarDeals[0])));
      this.logger.info('First similar deal:', JSON.stringify(redactedSimilarDeal, null, 2).substring(0, 1000) + '...');
    }
    
    const defaultPrompt = `You are an expert at analyzing business deals and determining how well they match an ideal client profile. 
Your task is to analyze the given deal record and provide:
1. A score from 0-100 indicating how well this deal matches an ideal client profile
2. A brief summary explaining the score and key factors considered

Please format your response as a JSON object with two fields:
- score: number between 0-100
- summary: string explaining the score

Take into consideration the following factors:
- Deal information (amount, stage, pipeline, close date)
- Company details (industry, size, revenue)
- Contact information (role, seniority, engagement)
- Similar deals that have been previously scored (learn from these examples)
- The overall fit of this deal compared to previously successful deals

Base your analysis on the complete record data and the similar deals provided for context.`;

    // Helper function to safely extract property with fallbacks
    const getProperty = (obj: any, propPath: string, defaultValue: string = 'Unknown'): string => {
      if (!obj) return defaultValue;
      
      // Handle nested properties with dot notation
      const props = propPath.split('.');
      let value = obj;
      
      for (const prop of props) {
        if (value && typeof value === 'object' && prop in value) {
          value = value[prop];
        } else {
          return defaultValue;
        }
      }
      
      // Make sure we have a usable string value
      if (value === null || value === undefined || value === '') {
        return defaultValue;
      }
      
      return String(value);
    };

    // Build sections for the prompt
    let dealSection = "CURRENT DEAL TO ANALYZE:\n";
    
    // First try to access properties directly from the deal object
    const deal = completeRecord.deal || {};
    const dealProps = deal.properties || {};
    
    // Log the deal properties to help debugging
    this.logger.info('Deal properties:', JSON.stringify(dealProps, null, 2));
    
    dealSection += `Deal ID: ${getProperty(deal, 'id')}\n`;
    dealSection += `Amount: ${getProperty(dealProps, 'amount')}\n`;
    dealSection += `Deal Name: ${getProperty(dealProps, 'dealname')}\n`;
    dealSection += `Stage: ${getProperty(dealProps, 'dealstage')}\n`;
    dealSection += `Stage Label: ${getProperty(dealProps, 'hs_pipeline_stage')}\n`;
    dealSection += `Close Date: ${getProperty(dealProps, 'closedate')}\n`;
    dealSection += `Pipeline: ${getProperty(dealProps, 'pipeline')}\n`;
    dealSection += `Created Date: ${getProperty(dealProps, 'createdate')}\n`;
    dealSection += `Last Modified Date: ${getProperty(dealProps, 'hs_lastmodifieddate')}\n`;
    dealSection += `Owner: ${getProperty(dealProps, 'hubspot_owner_id')}\n`;
    
    // Include all available properties to ensure we don't miss anything important
    dealSection += "\nALL AVAILABLE DEAL PROPERTIES:\n";
    for (const [key, value] of Object.entries(dealProps)) {
      if (value && typeof value === 'string' && value.trim() !== '' && !key.startsWith('hs_') && key !== 'createdate') {
        dealSection += `${key}: ${value}\n`;
      }
    }
    
    // Add associated companies
    let companiesSection = "\nASSOCIATED COMPANIES:\n";
    if (completeRecord.companies && completeRecord.companies.length > 0) {
      for (const company of completeRecord.companies) {
        const companyProps = company.properties || {};
        
        // Log the company properties for debugging
        this.logger.info('Company properties:', JSON.stringify(companyProps, null, 2));
        
        companiesSection += `Company ID: ${getProperty(company, 'id')}\n`;
        companiesSection += `Name: ${getProperty(companyProps, 'name')}\n`;
        companiesSection += `Industry: ${getProperty(companyProps, 'industry')}\n`;
        companiesSection += `Size: ${getProperty(companyProps, 'numberofemployees')} employees\n`;
        companiesSection += `Annual Revenue: ${getProperty(companyProps, 'annualrevenue')}\n`;
        companiesSection += `Website: ${getProperty(companyProps, 'website')}\n`;
        companiesSection += `Description: ${getProperty(companyProps, 'description')}\n`;
        
        // Build location information
        const city = getProperty(companyProps, 'city', '');
        const state = getProperty(companyProps, 'state', '');
        const country = getProperty(companyProps, 'country', '');
        const location = [city, state, country].filter(item => item && item !== 'Unknown').join(', ');
        companiesSection += `Location: ${location || 'Unknown'}\n`;
        
        // Include all available properties to ensure we don't miss anything important
        companiesSection += "\nALL AVAILABLE COMPANY PROPERTIES:\n";
        for (const [key, value] of Object.entries(companyProps)) {
          if (value && typeof value === 'string' && value.trim() !== '' && 
              !['name', 'industry', 'numberofemployees', 'annualrevenue', 'website', 'city', 'state', 'country'].includes(key) &&
              !key.startsWith('hs_')) {
            companiesSection += `${key}: ${value}\n`;
          }
        }
        
        companiesSection += "\n";
      }
    } else {
      companiesSection += "No associated companies found.\n";
    }
    
    // Add associated contacts
    let contactsSection = "\nASSOCIATED CONTACTS:\n";
    if (completeRecord.contacts && completeRecord.contacts.length > 0) {
      for (const contact of completeRecord.contacts) {
        const contactProps = contact.properties || {};
        
        // Log the contact properties for debugging
        this.logger.info('Contact properties:', JSON.stringify(contactProps, null, 2));
        
        contactsSection += `Contact ID: ${getProperty(contact, 'id')}\n`;
        
        // Build full name properly
        const firstName = getProperty(contactProps, 'firstname', '');
        const lastName = getProperty(contactProps, 'lastname', '');
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        contactsSection += `Name: ${fullName || 'Unknown'}\n`;
        
        contactsSection += `Title: ${getProperty(contactProps, 'jobtitle')}\n`;
        contactsSection += `Email: ${getProperty(contactProps, 'email')}\n`;
        contactsSection += `Phone: ${getProperty(contactProps, 'phone')}\n`;
        contactsSection += `Lifecycle Stage: ${getProperty(contactProps, 'lifecyclestage')}\n`;
        contactsSection += `Lead Status: ${getProperty(contactProps, 'hs_lead_status')}\n`;
        
        // Include all available properties to ensure we don't miss anything important
        contactsSection += "\nALL AVAILABLE CONTACT PROPERTIES:\n";
        for (const [key, value] of Object.entries(contactProps)) {
          if (value && typeof value === 'string' && value.trim() !== '' && 
              !['firstname', 'lastname', 'jobtitle', 'email', 'phone', 'lifecyclestage'].includes(key) &&
              !key.startsWith('hs_')) {
            contactsSection += `${key}: ${value}\n`;
          }
        }
        
        contactsSection += "\n";
      }
    } else {
      contactsSection += "No associated contacts found.\n";
    }
    
    // Add similar deals section with better formatting and more information
    let similarDealsSection = "\nSIMILAR DEALS FOR REFERENCE:\n";
    if (similarDeals && similarDeals.length > 0) {
      for (let i = 0; i < similarDeals.length; i++) {
        const similar = similarDeals[i];
        similarDealsSection += `\n=== SIMILAR DEAL ${i+1} ===\n`;
        
        // Format similarity score as percentage
        const similarityPercentage = similar.similarity ? Math.round(similar.similarity * 100) : 0;
        similarDealsSection += `Similarity: ${similarityPercentage}%\n`;
        
        // Include previous scoring information if available
        if (similar.existingScore) {
          similarDealsSection += `Previous Score: ${similar.existingScore.score}/100\n`;
          similarDealsSection += `Score Explanation: ${similar.existingScore.summary}\n`;
          similarDealsSection += `Last Scored: ${similar.existingScore.lastScored}\n`;
        }
        
        // Include deal metadata if available
        if (similar.record) {
          const metadata = similar.record;
          similarDealsSection += "\nDEAL DETAILS:\n";
          
          // Try to extract key properties using different possible paths
          const amount = getProperty(metadata, 'properties.amount') || 
                         getProperty(metadata, 'amount') || 'Unknown';
          
          const dealStage = getProperty(metadata, 'properties.dealstage') || 
                           getProperty(metadata, 'dealstage') || 'Unknown';
          
          const pipeline = getProperty(metadata, 'properties.pipeline') || 
                          getProperty(metadata, 'pipeline') || 'Unknown';
          
          const dealName = getProperty(metadata, 'properties.dealname') || 
                          getProperty(metadata, 'dealname') || 'Unknown';
          
          similarDealsSection += `Deal Name: ${dealName}\n`;
          similarDealsSection += `Amount: ${amount}\n`;
          similarDealsSection += `Deal Stage: ${dealStage}\n`;
          similarDealsSection += `Pipeline: ${pipeline}\n`;
          
          // Include additional metadata that might be available
          const createdDate = getProperty(metadata, 'properties.createdate') || 
                             getProperty(metadata, 'createdate') || 'Unknown';
          
          const closeDate = getProperty(metadata, 'properties.closedate') || 
                           getProperty(metadata, 'closedate') || 'Unknown';
          
          similarDealsSection += `Created Date: ${createdDate}\n`;
          similarDealsSection += `Close Date: ${closeDate}\n`;
          
          // Try to extract industry information
          const industry = getProperty(metadata, 'properties.industry') || 
                          getProperty(metadata, 'industry') || 
                          getProperty(metadata, 'company.industry') || 'Unknown';
          
          if (industry !== 'Unknown') {
            similarDealsSection += `Industry: ${industry}\n`;
          }
        }
        
        similarDealsSection += "\n";
      }
    } else {
      similarDealsSection += "No similar deals found for reference.\n";
      similarDealsSection += "\nNOTE: This may be because this is the first deal being scored, or because the vector search didn't find any matches. Please provide your best assessment based on the information available.\n";
    }
    
    // Construct the full prompt
    const fullPrompt = `${scoringPrompt || defaultPrompt}

${dealSection}

${companiesSection}

${contactsSection}

${similarDealsSection}

Based on all the information above, please score this deal and provide a detailed explanation.
Format your response as a JSON object with 'score' and 'summary' fields.`;

    // Log the full prompt for debugging
    this.logger.info('Full AI prompt (first 1000 chars):', fullPrompt.substring(0, 1000) + '...');

    try {
      let response: AIResponse;
      
      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(model, fullPrompt, temperature, maxTokens);
          break;
        case 'anthropic':
          response = await this.callAnthropic(model, fullPrompt, temperature, maxTokens);
          break;
        case 'google':
          response = await this.callGoogle(model, fullPrompt, temperature, maxTokens);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      // Format the summary to include positives and negatives
      const formattedSummary = this.formatSummaryFromResponse(response);

      // Return the score and formatted summary
      return { 
        score: response.score, 
        summary: formattedSummary,
        fullPrompt 
      };
    } catch (error) {
      this.logger.error('Error getting enhanced AI response:', error);
      throw error;
    }
  }

  // Helper method to redact PII from records before logging
  private redactPII(record: any): any {
    // If it's an array, process each item
    if (Array.isArray(record)) {
      return record.map(item => this.redactPII(item));
    }
    
    // If it's not an object or is null, return as is
    if (typeof record !== 'object' || record === null) {
      return record;
    }
    
    // Create a new object to avoid mutating the original
    const redacted = { ...record };
    
    // Process contacts
    if (redacted.contacts) {
      redacted.contacts = redacted.contacts.map((contact: any) => {
        if (contact && contact.properties) {
          return {
            ...contact,
            properties: {
              ...contact.properties,
              // Redact PII fields
              email: contact.properties.email ? '[REDACTED EMAIL]' : undefined,
              firstname: contact.properties.firstname ? '[REDACTED FIRSTNAME]' : undefined,
              lastname: contact.properties.lastname ? '[REDACTED LASTNAME]' : undefined,
              phone: contact.properties.phone ? '[REDACTED PHONE]' : undefined
            }
          };
        }
        return contact;
      });
    }
    
    // Process single contact
    if (redacted.properties && (redacted.recordType === 'contact' || record.metadata?.recordType === 'contact')) {
      redacted.properties = {
        ...redacted.properties,
        email: redacted.properties.email ? '[REDACTED EMAIL]' : undefined,
        firstname: redacted.properties.firstname ? '[REDACTED FIRSTNAME]' : undefined,
        lastname: redacted.properties.lastname ? '[REDACTED LASTNAME]' : undefined,
        phone: redacted.properties.phone ? '[REDACTED PHONE]' : undefined
      };
    }
    
    // Process deal name (may contain customer names)
    if (redacted.properties && redacted.properties.dealname) {
      redacted.properties.dealname = '[REDACTED DEAL NAME]';
    }
    
    // Process record property
    if (redacted.record && typeof redacted.record === 'object') {
      redacted.record = this.redactPII(redacted.record);
    }
    
    return redacted;
  }
} 