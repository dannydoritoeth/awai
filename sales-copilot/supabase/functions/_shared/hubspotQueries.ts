/**
 * Shared HubSpot query functions to ensure consistent search criteria
 * across different functions (auto-training, get-training-summary, etc.)
 */

import { Logger } from './logger.ts';

const logger = new Logger('hubspotQueries');

/**
 * Get the timestamp for 90 days ago, formatted for HubSpot queries
 */
export function getNinetyDaysAgoTimestamp(): string {
  const ninety_days_ago = new Date();
  ninety_days_ago.setDate(ninety_days_ago.getDate() - 90);
  return Math.floor(ninety_days_ago.getTime() / 1000).toString();
}

/**
 * Create standardized search criteria for ideal deals (won deals in last 90 days)
 */
export function createIdealDealsSearchCriteria(
  limit: number = 25,
  after: string | null = null
): any {
  const timestamp = getNinetyDaysAgoTimestamp();
  logger.info(`Creating ideal deals search criteria with timestamp ${timestamp}, limit ${limit}, after ${after || 'null'}`);
  
  return {
    filterGroups: [{
      filters: [
        {
          propertyName: 'createdate',
          operator: 'GTE',
          value: timestamp
        },
        {
          propertyName: 'dealstage',
          operator: 'EQ',
          value: 'closedwon'
        }
      ]
    }],
    sorts: [
      {
        propertyName: 'createdate',
        direction: 'DESCENDING'
      }
    ],
    properties: [
      'dealname',
      'createdate',
      'closedate',
      'amount',
      'dealstage',
      'hs_lastmodifieddate',
      'hs_object_id',
      'description',
      'notes_last_updated'
    ],
    limit,
    associations: ['contacts', 'companies'],
    ...(after ? { after } : {})
  };
}

/**
 * Create standardized search criteria for non-ideal deals (lost deals in last 90 days)
 */
export function createNonIdealDealsSearchCriteria(
  limit: number = 25,
  after: string | null = null
): any {
  const timestamp = getNinetyDaysAgoTimestamp();
  logger.info(`Creating non-ideal deals search criteria with timestamp ${timestamp}, limit ${limit}, after ${after || 'null'}`);
  
  return {
    filterGroups: [{
      filters: [
        {
          propertyName: 'createdate',
          operator: 'GTE',
          value: timestamp
        },
        {
          propertyName: 'dealstage',
          operator: 'EQ',
          value: 'closedlost'
        }
      ]
    }],
    sorts: [
      {
        propertyName: 'createdate',
        direction: 'DESCENDING'
      }
    ],
    properties: [
      'dealname',
      'createdate',
      'closedate',
      'amount',
      'dealstage',
      'hs_lastmodifieddate',
      'hs_object_id',
      'description',
      'notes_last_updated'
    ],
    limit,
    associations: ['contacts', 'companies'],
    ...(after ? { after } : {})
  };
}

/**
 * Create standardized search criteria for deals based on type (ideal or non-ideal)
 */
export function createDealsSearchCriteria(
  type: 'ideal' | 'nonideal',
  limit: number = 25,
  after: string | null = null
): any {
  if (type === 'ideal') {
    return createIdealDealsSearchCriteria(limit, after);
  } else {
    return createNonIdealDealsSearchCriteria(limit, after);
  }
} 