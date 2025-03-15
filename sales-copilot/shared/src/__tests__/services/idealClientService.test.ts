/// <reference types="jest" />
import { IdealClientService } from '../../services/idealClientService';
import { HubspotContact, HubspotCompany, HubspotDeal } from '../../types';

describe('IdealClientService', () => {
  let service: IdealClientService;
  const mockVectorStore = {
    storeDocument: jest.fn().mockResolvedValue({ id: 'vec_1' }),
    upsert: jest.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    service = new IdealClientService();
    service.setVectorStore(mockVectorStore, 'test-namespace');
  });

  describe('validateLabel', () => {
    it('should validate label', () => {
      expect(service.validateLabel('ideal')).toBe('ideal');
      expect(service.validateLabel('less-ideal')).toBe('less-ideal');
      expect(() => service.validateLabel('invalid')).toThrow();
    });
  });

  describe('validateType', () => {
    it('should validate type', () => {
      expect(service.validateType('contact')).toBe('contacts');
      expect(service.validateType('company')).toBe('companies');
      expect(service.validateType('deal')).toBe('deals');
      expect(service.validateType('contacts')).toBe('contacts');
      expect(service.validateType('companies')).toBe('companies');
      expect(service.validateType('deals')).toBe('deals');
      expect(() => service.validateType('invalid')).toThrow();
    });
  });

  describe('storeIdealClientData', () => {
    it('should store contact data', async () => {
      const contact: HubspotContact = {
        id: '1',
        properties: {
          name: 'Test Contact',
          email: 'test@example.com'
        }
      };

      const result = await service.storeIdealClientData(
        contact,
        'contact',
        'ideal'
      );

      expect(result.stored).toBe(true);
      expect(result.type).toBe('contacts');
      expect(result.label).toBe('ideal');
      expect(mockVectorStore.storeDocument).toHaveBeenCalled();
    });

    it('should store company data', async () => {
      const company: HubspotCompany = {
        id: '1',
        properties: {
          name: 'Test Company',
          domain: 'test.com'
        }
      };

      const result = await service.storeIdealClientData(
        company,
        'company',
        'ideal'
      );

      expect(result.stored).toBe(true);
      expect(result.type).toBe('companies');
      expect(result.label).toBe('ideal');
      expect(mockVectorStore.storeDocument).toHaveBeenCalled();
    });

    it('should store deal data', async () => {
      const deal: HubspotDeal = {
        id: '1',
        properties: {
          dealname: 'Test Deal',
          amount: '10000'
        }
      };

      const result = await service.storeIdealClientData(
        deal,
        'deal',
        'ideal'
      );

      expect(result.stored).toBe(true);
      expect(result.type).toBe('deals');
      expect(result.label).toBe('ideal');
      expect(mockVectorStore.storeDocument).toHaveBeenCalled();
    });
  });

  describe('processHubSpotLists', () => {
    it('should process contact lists', async () => {
      const mockHubspotClient = {
        getIdealAndLessIdealData: jest.fn().mockResolvedValue({
          type: 'contacts',
          ideal: [{ id: '1', properties: {} }],
          lessIdeal: [{ id: '2', properties: {} }]
        })
      };

      const result = await service.processHubSpotLists(mockHubspotClient as any, 'contact');

      expect(result.success).toBe(true);
      expect(result.type).toBe('contacts');
      expect(result.summary.ideal.processed).toBe(1);
      expect(result.summary.lessIdeal.processed).toBe(1);
    });

    it('should handle API errors', async () => {
      const mockHubspotClient = {
        getIdealAndLessIdealData: jest.fn().mockRejectedValue(new Error('API Error'))
      };

      const result = await service.processHubSpotLists(mockHubspotClient as any, 'contact');

      expect(result.success).toBe(false);
      expect(result.type).toBe('contact');
      expect(result.summary.ideal.processed).toBe(0);
      expect(result.summary.lessIdeal.processed).toBe(0);
    });
  });
}); 