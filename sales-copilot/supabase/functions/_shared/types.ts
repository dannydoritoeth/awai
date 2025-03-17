export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  temperature: number;
  maxTokens: number;
  scoringPrompt: string;
}

export interface HubspotAccount {
  portal_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  status: 'active' | 'inactive';
  ai_provider: AIConfig['provider'];
  ai_model: string;
  ai_temperature: number;
  ai_max_tokens: number;
  scoring_prompt: string;
  scoring_prompt_updated_at: string;
}

export interface HubSpotWebhookEvent {
  eventId: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  occurredAt: number;
  subscriptionType: 'contact.creation' | 'company.creation' | 'deal.creation';
  attemptNumber: number;
  objectId: number;
  changeSource: string;
  changeFlag: string;
} 