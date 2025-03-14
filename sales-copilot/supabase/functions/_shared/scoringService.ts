import { HubspotClient } from './hubspotClient';

export interface ScoringResult {
  score: number;
  summary: string;
  lastScored: string;
}

export class ScoringService {
  private hubspotClient: HubspotClient;

  constructor(accessToken: string) {
    this.hubspotClient = new HubspotClient(accessToken);
  }

  async scoreContact(contactId: string): Promise<ScoringResult> {
    console.log(`Scoring contact ${contactId}`);
    
    try {
      const contact = await this.hubspotClient.getContact(contactId);
      
      // TODO: Implement actual scoring logic
      const score = 85;
      const summary = "High potential based on engagement and profile completeness";
      const lastScored = new Date().toISOString();

      await this.hubspotClient.updateContact(contactId, {
        ideal_client_score: score.toString(),
        ideal_client_summary: summary,
        ideal_client_last_scored: lastScored,
      });

      return { score, summary, lastScored };
    } catch (error) {
      console.error('Error scoring contact:', error);
      throw error;
    }
  }

  async scoreCompany(companyId: string): Promise<ScoringResult> {
    console.log(`Scoring company ${companyId}`);
    
    try {
      const company = await this.hubspotClient.getCompany(companyId);
      
      // TODO: Implement actual scoring logic
      const score = 90;
      const summary = "Strong company fit based on industry and size";
      const lastScored = new Date().toISOString();

      await this.hubspotClient.updateCompany(companyId, {
        company_fit_score: score.toString(),
        company_fit_summary: summary,
        company_fit_last_scored: lastScored,
      });

      return { score, summary, lastScored };
    } catch (error) {
      console.error('Error scoring company:', error);
      throw error;
    }
  }

  async scoreDeal(dealId: string): Promise<ScoringResult> {
    console.log(`Scoring deal ${dealId}`);
    
    try {
      const deal = await this.hubspotClient.getDeal(dealId);
      
      // TODO: Implement actual scoring logic
      const score = 75;
      const summary = "Moderate deal quality based on value and timeline";
      const lastScored = new Date().toISOString();

      await this.hubspotClient.updateDeal(dealId, {
        deal_quality_score: score.toString(),
        deal_quality_summary: summary,
        deal_quality_last_scored: lastScored,
      });

      return { score, summary, lastScored };
    } catch (error) {
      console.error('Error scoring deal:', error);
      throw error;
    }
  }
} 