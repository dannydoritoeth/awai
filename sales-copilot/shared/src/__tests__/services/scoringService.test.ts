/// <reference types="jest" />
import { ScoringService } from '../../services/scoringService';
import { HubspotClient } from '../../services/hubspotClient';
import { HubspotRecord } from '../../types';

jest.mock('../../services/hubspotClient');

describe('ScoringService', () => {
  let service: ScoringService;
  let mockHubspotClient: jest.Mocked<HubspotClient>;

  beforeEach(() => {
    mockHubspotClient = {
      getContact: jest.fn().mockImplementation(async (id: string): Promise<HubspotRecord> => ({
        id,
        properties: {}
      })),
      getCompany: jest.fn().mockImplementation(async (id: string): Promise<HubspotRecord> => ({
        id,
        properties: {}
      })),
      getDeal: jest.fn().mockImplementation(async (id: string): Promise<HubspotRecord> => ({
        id,
        properties: {}
      })),
      updateContact: jest.fn().mockImplementation(async (id: string, data: any): Promise<HubspotRecord> => ({
        id,
        properties: data
      })),
      updateCompany: jest.fn().mockImplementation(async (id: string, data: any): Promise<HubspotRecord> => ({
        id,
        properties: data
      })),
      updateDeal: jest.fn().mockImplementation(async (id: string, data: any): Promise<HubspotRecord> => ({
        id,
        properties: data
      }))
    } as any;

    // Mock the HubspotClient constructor to return our mock
    (HubspotClient as jest.Mock).mockImplementation(() => mockHubspotClient);

    service = new ScoringService('test-token');
  });

  describe('scoreContact', () => {
    it('should calculate score for contact', async () => {
      const mockContact: HubspotRecord = {
        id: '1',
        properties: {
          name: 'Test Contact',
          email: 'test@example.com',
          firstname: 'Test',
          lastname: 'Contact',
          phone: '1234567890',
          company: 'Test Company',
          industry: 'Technology',
          lifecyclestage: 'customer',
          hs_lead_status: 'active',
          jobtitle: 'Developer',
          createdate: '2024-01-01',
          lastmodifieddate: '2024-01-01'
        }
      };

      mockHubspotClient.getContact.mockResolvedValueOnce(mockContact);

      await expect(service.scoreContact('1')).resolves.not.toThrow();
      expect(mockHubspotClient.getContact).toHaveBeenCalledWith('1');
      expect(mockHubspotClient.updateContact).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          ideal_client_score: expect.any(Number),
          ideal_client_summary: expect.any(String),
          ideal_client_last_scored: expect.any(String)
        })
      );
    });
  });

  describe('scoreCompany', () => {
    it('should calculate score for company', async () => {
      const mockCompany: HubspotRecord = {
        id: '1',
        properties: {
          name: 'Test Company',
          domain: 'test.com',
          industry: 'Technology',
          numberofemployees: '100',
          annualrevenue: '1000000',
          type: 'customer',
          description: 'Test company description',
          createdate: '2024-01-01',
          lastmodifieddate: '2024-01-01'
        }
      };

      mockHubspotClient.getCompany.mockResolvedValueOnce(mockCompany);

      await expect(service.scoreCompany('1')).resolves.not.toThrow();
      expect(mockHubspotClient.getCompany).toHaveBeenCalledWith('1');
      expect(mockHubspotClient.updateCompany).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          company_fit_score: expect.any(Number),
          company_fit_summary: expect.any(String),
          company_fit_last_scored: expect.any(String)
        })
      );
    });
  });

  describe('scoreDeal', () => {
    it('should calculate score for deal', async () => {
      const mockDeal: HubspotRecord = {
        id: '1',
        properties: {
          dealname: 'Test Deal',
          dealstage: 'closedwon',
          amount: '10000',
          closedate: '2024-01-01',
          pipeline: 'default',
          dealtype: 'newbusiness',
          createdate: '2024-01-01',
          lastmodifieddate: '2024-01-01'
        }
      };

      mockHubspotClient.getDeal.mockResolvedValueOnce(mockDeal);

      await expect(service.scoreDeal('1')).resolves.not.toThrow();
      expect(mockHubspotClient.getDeal).toHaveBeenCalledWith('1');
      expect(mockHubspotClient.updateDeal).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          deal_quality_score: expect.any(Number),
          deal_quality_summary: expect.any(String),
          deal_quality_last_scored: expect.any(String)
        })
      );
    });
  });
}); 