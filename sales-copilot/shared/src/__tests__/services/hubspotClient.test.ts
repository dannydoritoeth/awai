/// <reference types="jest" />
import { HubspotClient } from '../../services/hubspotClient';
import { HubspotList, HubspotContact, HubspotCompany, HubspotDeal } from '../../types';

// Mock the fetch function
global.fetch = jest.fn();

describe('HubspotClient', () => {
  let client: HubspotClient;
  const mockAccessToken = 'test-token';

  beforeEach(() => {
    client = new HubspotClient(mockAccessToken);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('findListByName', () => {
    it('should fetch a list by name', async () => {
      const mockResponse = {
        lists: [
          {
            listId: '123',
            name: 'Test List',
            additionalProperties: {
              hs_list_size: 100
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.findListByName('Test List');
      expect(result).toEqual({
        id: '123',
        name: 'Test List',
        size: 100
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/crm/v3/lists/search'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`
          })
        })
      );
    });

    it('should throw error when list not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ lists: [] })
      });

      await expect(client.findListByName('Non-existent List'))
        .rejects
        .toThrow('No list found with name: Non-existent List');
    });
  });

  describe('getContactsFromList', () => {
    it('should fetch contacts from a list', async () => {
      const mockListResponse = {
        results: [{ recordId: '123' }]
      };

      const mockContactResponse = {
        id: '123',
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
        },
        associations: {
          companies: { results: [] },
          deals: { results: [] }
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockListResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockContactResponse)
        });

      const result = await client.getContactsFromList('list-id');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
      expect(result[0].properties.name).toBe('Test Contact');
      expect(result[0].enriched).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCompaniesFromList', () => {
    it('should fetch companies from a list', async () => {
      const mockListResponse = {
        results: [{ recordId: '123' }]
      };

      const mockCompanyResponse = {
        id: '123',
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
        },
        associations: {
          contacts: { results: [] },
          deals: { results: [] }
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockListResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCompanyResponse)
        });

      const result = await client.getCompaniesFromList('list-id');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
      expect(result[0].properties.name).toBe('Test Company');
      expect(result[0].enriched).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDealsFromList', () => {
    it('should fetch deals from a list', async () => {
      const mockListResponse = {
        results: [{ recordId: '123' }]
      };

      const mockDealResponse = {
        id: '123',
        properties: {
          dealname: 'Test Deal',
          dealstage: 'closedwon',
          amount: '10000',
          closedate: '2024-01-01',
          pipeline: 'default',
          dealtype: 'newbusiness',
          createdate: '2024-01-01',
          lastmodifieddate: '2024-01-01'
        },
        associations: {
          contacts: { results: [] },
          companies: { results: [] },
          line_items: { results: [] }
        }
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockListResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockDealResponse)
        });

      const result = await client.getDealsFromList('list-id');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
      expect(result[0].properties.dealname).toBe('Test Deal');
      expect(result[0].enriched).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getIdealAndLessIdealData', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    it('should fetch and categorize data based on type', async () => {
      const client = new HubspotClient('test-token');

      // Mock list responses
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            lists: [
              { listId: 'ideal-list', name: 'Ideal contacts' }
            ]
          })
        })
      );

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            lists: [
              { listId: 'less-ideal-list', name: 'Less Ideal contacts' }
            ]
          })
        })
      );

      // Mock contact responses for ideal list
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{ recordId: '1' }]
          })
        })
      );

      // Mock contact responses for less ideal list
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{ recordId: '2' }]
          })
        })
      );

      // Mock contact details for ideal contact
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '1',
            properties: {
              email: 'ideal@example.com',
              firstname: 'Ideal',
              lastname: 'Contact'
            }
          })
        })
      );

      // Mock contact details for less ideal contact
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '2',
            properties: {
              email: 'less-ideal@example.com',
              firstname: 'Less Ideal',
              lastname: 'Contact'
            }
          })
        })
      );

      const result = await client.getIdealAndLessIdealData('contacts');

      expect(result.type).toBe('contacts');
      expect(result.ideal).toHaveLength(1);
      expect(result.lessIdeal).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(6);
    });

    it('should handle empty results', async () => {
      const client = new HubspotClient('test-token');

      // Mock list responses
      (global.fetch as jest.Mock).mockImplementation((url: string, options: any) => {
        if (url.includes('/crm/v3/lists/search')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              lists: []
            })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      try {
        await client.getIdealAndLessIdealData('contacts');
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).toBe('No list found with name: Ideal contacts');
      }

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1,
        'https://api.hubapi.com/crm/v3/lists/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            query: 'Ideal contacts',
            processingTypes: ['MANUAL', 'DYNAMIC']
          })
        })
      );
      expect(global.fetch).toHaveBeenNthCalledWith(2,
        'https://api.hubapi.com/crm/v3/lists/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            query: 'Less Ideal contacts',
            processingTypes: ['MANUAL', 'DYNAMIC']
          })
        })
      );
    });
  });
}); 