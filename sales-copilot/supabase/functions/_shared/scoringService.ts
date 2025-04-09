import { HubspotClient } from './hubspotClient.ts';
import { Logger } from './logger.ts';
import { AIConfig, HubspotAccount } from './types.ts';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { SubscriptionService } from "./subscriptionService.ts";
import { PineconeClient } from './pineconeClient.ts';

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

export class ScoringService {
  private hubspotClient: HubspotClient;
  private logger: Logger;
  private aiConfig: AIConfig;
  private portalId: string;
  private openai: OpenAI;
  private pineconeClient: PineconeClient;
  private subscriptionService: SubscriptionService;

  constructor(
    hubspotClient: HubspotClient,
    aiConfig: AIConfig,
    portalId: string,
    logger: Logger
  ) {
    this.hubspotClient = hubspotClient;
    this.aiConfig = aiConfig;
    this.portalId = portalId;
    this.logger = logger;

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
      
      // Query Pinecone using portal ID as namespace
      const queryResponse = await this.pineconeClient.query(
        `${this.portalId}-${type}`,
        embedding,
        {},
        5
      );

      return queryResponse.matches.map(match => match.metadata);
    } catch (error) {
      this.logger.error(`Error getting similar ${type}s:`, error);
      return []; // Return empty array if similarity search fails
    }
  }

  private async storeEmbedding(record: any, type: 'contact' | 'company' | 'deal'): Promise<void> {
    try {
      const embedding = await this.getEmbeddings(record);
      
      await this.pineconeClient.upsertDocumentsWithEmbeddings([{
        id: record.id,
        text: JSON.stringify(record),
        metadata: record,
        embedding: embedding
      }], `${this.portalId}-${type}`);
    } catch (error) {
      this.logger.error('Error storing embedding:', error);
      // Don't throw the error as this is not critical for scoring
    }
  }

  private async getAIResponse(prompt: string, data: any, similarRecords: any[] = []): Promise<{ score: number; summary: string }> {
    const { provider, model, temperature, maxTokens, scoringPrompt } = this.aiConfig;
    
    const defaultPrompt = `You are an expert at analyzing business records and determining how well they match an ideal client profile. 
Your task is to analyze the given record and provide:
1. A score from 0-100 indicating how well this record matches an ideal client profile
2. A brief summary explaining the score and key factors considered

Please format your response as a JSON object with two fields:
- score: number between 0-100
- summary: string explaining the score

Consider factors such as:
- Industry and company size
- Job title and seniority
- Deal size and stage
- Past interactions and engagement
- Similar successful records provided for context

Base your analysis on the record data and any similar records provided for context.`;

    // Construct the full prompt with similar records context
    const fullPrompt = `${scoringPrompt || defaultPrompt}

${similarRecords.length > 0 ? `Similar records for context:
${JSON.stringify(similarRecords, null, 2)}

` : ''}Record to analyze:
${JSON.stringify(data, null, 2)}`;

    try {
      let response;
      
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

      return response;
    } catch (error) {
      this.logger.error('Error getting AI response:', error);
      throw error;
    }
  }

  private async callOpenAI(model: string, prompt: string, temperature: number, maxTokens: number): Promise<{ score: number; summary: string }> {
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

  private async callAnthropic(model: string, prompt: string, temperature: number, maxTokens: number): Promise<{ score: number; summary: string }> {
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

  private async callGoogle(model: string, prompt: string, temperature: number, maxTokens: number): Promise<{ score: number; summary: string }> {
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

  private async recordScoreUsage(): Promise<void> {
    await this.subscriptionService.recordScore(this.portalId);
  }

  async scoreContact(contactId: string): Promise<ScoringResult> {
    await this.checkScoringLimit();
    this.logger.info(`Scoring contact ${contactId}`);
    
    try {
      const contact = await this.hubspotClient.getContact(contactId);
      const similarContacts = await this.getSimilarRecords(contact, 'contact');
      const result = await this.getAIResponse('Score this contact', contact, similarContacts);
      const lastScored = new Date().toISOString();

      // Store the embedding for future similarity searches
      await this.storeEmbedding(contact, 'contact');

      // Update the contact in HubSpot
      await this.hubspotClient.updateContact(contactId, {
        ideal_client_score: result.score.toString(),
        ideal_client_summary: result.summary,
        ideal_client_last_scored: lastScored
      });

      await this.recordScoreUsage();
      return { ...result, lastScored };
    } catch (error) {
      this.logger.error('Error scoring contact:', error);
      throw error;
    }
  }

  async scoreCompany(companyId: string): Promise<ScoringResult> {
    await this.checkScoringLimit();
    this.logger.info(`Scoring company ${companyId}`);
    
    try {
      const company = await this.hubspotClient.getCompany(companyId);
      const similarCompanies = await this.getSimilarRecords(company, 'company');
      const result = await this.getAIResponse('Score this company', company, similarCompanies);
      const lastScored = new Date().toISOString();

      // Store the embedding for future similarity searches
      await this.storeEmbedding(company, 'company');

      // Update the company in HubSpot
      await this.hubspotClient.updateCompany(companyId, {
        ideal_client_score: result.score.toString(),
        ideal_client_summary: result.summary,
        ideal_client_last_scored: lastScored
      });

      await this.recordScoreUsage();
      return { ...result, lastScored };
    } catch (error) {
      this.logger.error('Error scoring company:', error);
      throw error;
    }
  }

  async scoreDeal(dealId: string): Promise<ScoringResult> {
    await this.checkScoringLimit();
    this.logger.info(`Scoring deal ${dealId}`);
    
    try {
      const deal = await this.hubspotClient.getDeal(dealId);
      const similarDeals = await this.getSimilarRecords(deal, 'deal');
      const result = await this.getAIResponse('Score this deal', deal, similarDeals);
      const lastScored = new Date().toISOString();

      // Store the embedding for future similarity searches
      await this.storeEmbedding(deal, 'deal');

      // Update the deal in HubSpot
      await this.hubspotClient.updateDeal(dealId, {
        ideal_client_score: result.score.toString(),
        ideal_client_summary: result.summary,
        ideal_client_last_scored: lastScored
      });

      await this.recordScoreUsage();
      return { ...result, lastScored };
    } catch (error) {
      this.logger.error('Error scoring deal:', error);
      throw error;
    }
  }
} 