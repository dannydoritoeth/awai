/// <reference types="jest" />
import {
  HubspotList,
  HubspotContact,
  HubspotCompany,
  HubspotDeal,
  IdealClientData,
  ProcessResult,
  StoreResult
} from '../types';

describe('Core Types', () => {
  describe('HubspotList', () => {
    it('should have required properties', () => {
      const list: HubspotList = {
        id: '123',
        name: 'Test List',
        size: 100
      };
      expect(list).toHaveProperty('id');
      expect(list).toHaveProperty('name');
      expect(list).toHaveProperty('size');
    });

    it('should enforce property types', () => {
      const list: HubspotList = {
        id: '123',
        name: 'Test List',
        size: 100
      };
      expect(typeof list.id).toBe('string');
      expect(typeof list.name).toBe('string');
      expect(typeof list.size).toBe('number');
    });
  });

  describe('HubspotContact', () => {
    it('should have required properties', () => {
      const contact: HubspotContact = {
        id: '123',
        properties: {}
      };
      expect(contact).toHaveProperty('id');
      expect(contact).toHaveProperty('properties');
    });

    it('should handle optional associations', () => {
      const contact: HubspotContact = {
        id: '123',
        properties: {},
        associations: {
          companies: {
            results: [{ id: '456' }]
          },
          deals: {
            results: [{ id: '789' }]
          }
        }
      };
      expect(contact.associations?.companies?.results).toHaveLength(1);
      expect(contact.associations?.deals?.results).toHaveLength(1);
    });
  });

  describe('HubspotCompany', () => {
    it('should have required properties', () => {
      const company: HubspotCompany = {
        id: '123',
        properties: {}
      };
      expect(company).toHaveProperty('id');
      expect(company).toHaveProperty('properties');
    });

    it('should handle enriched data', () => {
      const company: HubspotCompany = {
        id: '123',
        properties: {},
        enriched: {
          contacts: [],
          deals: [],
          metrics: {
            totalRevenue: 100000,
            totalDeals: 10,
            wonDeals: 5,
            activeContacts: 20,
            totalContacts: 50
          }
        }
      };
      expect(company.enriched?.metrics).toBeDefined();
      expect(typeof company.enriched?.metrics?.totalRevenue).toBe('number');
    });
  });

  describe('HubspotDeal', () => {
    it('should have required properties', () => {
      const deal: HubspotDeal = {
        id: '123',
        properties: {}
      };
      expect(deal).toHaveProperty('id');
      expect(deal).toHaveProperty('properties');
    });

    it('should handle enriched data with metrics', () => {
      const deal: HubspotDeal = {
        id: '123',
        properties: {},
        enriched: {
          contacts: [],
          companies: [],
          lineItems: [],
          metrics: {
            totalValue: 50000,
            lineItemCount: 3,
            contactCount: 2,
            companyCount: 1,
            salesCycleDays: 30
          }
        }
      };
      expect(deal.enriched?.metrics).toBeDefined();
      expect(typeof deal.enriched?.metrics?.totalValue).toBe('number');
    });
  });

  describe('IdealClientData', () => {
    it('should have required properties', () => {
      const data: IdealClientData = {
        ideal: [],
        lessIdeal: [],
        type: 'contact'
      };
      expect(data).toHaveProperty('ideal');
      expect(data).toHaveProperty('lessIdeal');
      expect(data).toHaveProperty('type');
    });

    it('should handle different data types', () => {
      const contactData: IdealClientData = {
        ideal: [{ id: '123', properties: {} }],
        lessIdeal: [{ id: '456', properties: {} }],
        type: 'contact'
      };
      expect(contactData.ideal[0]).toHaveProperty('id');
      expect(contactData.lessIdeal[0]).toHaveProperty('id');
    });
  });

  describe('ProcessResult', () => {
    it('should have required properties', () => {
      const result: ProcessResult = {
        success: true,
        type: 'contact',
        summary: {
          ideal: {
            processed: 10,
            successful: 8
          },
          lessIdeal: {
            processed: 5,
            successful: 3
          }
        }
      };
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('summary');
    });

    it('should handle optional details', () => {
      const result: ProcessResult = {
        success: true,
        type: 'contact',
        summary: {
          ideal: {
            processed: 10,
            successful: 8
          },
          lessIdeal: {
            processed: 5,
            successful: 3
          }
        },
        details: {
          ideal: [{ id: '123' }],
          lessIdeal: [{ id: '456' }]
        }
      };
      expect(result.details).toBeDefined();
      expect(result.details?.ideal).toHaveLength(1);
    });
  });

  describe('StoreResult', () => {
    it('should have required properties', () => {
      const result: StoreResult = {
        stored: true,
        type: 'contact',
        label: 'test',
        id: '123',
        vectorId: 'vec_123',
        namespace: 'test_namespace'
      };
      expect(result).toHaveProperty('stored');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('vectorId');
      expect(result).toHaveProperty('namespace');
    });

    it('should enforce property types', () => {
      const result: StoreResult = {
        stored: true,
        type: 'contact',
        label: 'test',
        id: '123',
        vectorId: 'vec_123',
        namespace: 'test_namespace'
      };
      expect(typeof result.stored).toBe('boolean');
      expect(typeof result.type).toBe('string');
      expect(typeof result.label).toBe('string');
      expect(typeof result.id).toBe('string');
      expect(typeof result.vectorId).toBe('string');
      expect(typeof result.namespace).toBe('string');
    });
  });
}); 