# @shared Project Requirements Document

## Overview
The `@shared` project is a TypeScript-based shared library that provides common functionality for interacting with HubSpot data and managing ideal client profiles. This document outlines the core functionality and interfaces that must be maintained for compatibility across the application.

## Core Components

### 1. Type Definitions (`types.ts`)

#### Logger Interface
- Purpose: Standardized logging interface across the application
- Required Methods:
  - `info(message: string, data?: any): void`
  - `error(message: string, error?: any): void`

#### HubSpot Data Models
1. **HubspotList**
   - Properties:
     - `id: string`
     - `name: string`
     - `size: number`

2. **HubspotContact**
   - Properties:
     - `id: string`
     - `properties: Record<string, any>`
     - Optional associations with companies and deals
     - Optional enriched data including associated companies and deals

3. **HubspotCompany**
   - Properties:
     - `id: string`
     - `properties: Record<string, any>`
     - Optional associations with contacts and deals
     - Optional enriched data including:
       - Associated contacts and deals
       - Metrics (totalRevenue, totalDeals, wonDeals, activeContacts, totalContacts)

4. **HubspotDeal**
   - Properties:
     - `id: string`
     - `properties: Record<string, any>`
     - Optional associations with contacts, companies, and line items
     - Optional enriched data including:
       - Associated contacts, companies, and line items
       - Metrics (totalValue, lineItemCount, contactCount, companyCount, salesCycleDays)

### 2. Core Interfaces

#### HubspotClientInterface
Required Methods:
- `findListByName(listName: string): Promise<HubspotList>`
- `getContactsFromList(listId: string): Promise<HubspotContact[]>`
- `getCompaniesFromList(listId: string): Promise<HubspotCompany[]>`
- `getDealsFromList(listId: string): Promise<HubspotDeal[]>`
- `getIdealAndLessIdealData(type: string): Promise<IdealClientData>`

#### IdealClientServiceInterface
Required Methods:
- `setVectorStore(vectorStore: any, namespace: string): void`
- `validateLabel(label: string): string`
- `validateType(type: string): string`
- `storeIdealClientData(data: any, type: string, label: string): Promise<StoreResult>`
- `processHubSpotLists(hubspotClient: HubspotClientInterface, type: string): Promise<ProcessResult>`

### 3. Data Processing Models

#### IdealClientData
- Structure:
  - `ideal: HubspotContact[] | HubspotCompany[] | HubspotDeal[]`
  - `lessIdeal: HubspotContact[] | HubspotCompany[] | HubspotDeal[]`
  - `type: string`

#### ProcessResult
- Structure:
  - `success: boolean`
  - `type: string`
  - `summary`: Object containing processing statistics for both ideal and less ideal data
  - Optional `details` containing processed data arrays

#### StoreResult
- Structure:
  - `stored: boolean`
  - `type: string`
  - `label: string`
  - `id: string`
  - `vectorId: string`
  - `namespace: string`

## Implementation Requirements

### HubspotClient Implementation
- Must implement all methods defined in HubspotClientInterface
- Must handle API rate limiting and pagination
- Must properly handle error cases and provide meaningful error messages
- Must maintain proper authentication and authorization

### IdealClientService Implementation
- Must implement all methods defined in IdealClientServiceInterface
- Must validate input data before processing
- Must handle vector store operations safely
- Must provide proper error handling and logging

### Scoring Service
- Must provide consistent scoring mechanisms for ideal client profiles
- Must handle different data types (contacts, companies, deals)
- Must maintain scoring criteria and thresholds

## Testing Requirements
- All interfaces must have corresponding test implementations
- Unit tests must cover all public methods
- Integration tests must verify HubSpot API interactions
- Vector store operations must be properly tested

## Dependencies
- TypeScript
- HubSpot API client
- Vector store implementation
- Logging system

## Version Compatibility
- Must maintain backward compatibility with existing interfaces
- Any breaking changes must be clearly documented and versioned

## Security Requirements
- API keys and sensitive data must be properly managed
- Authentication tokens must be securely stored and refreshed
- Data access must be properly controlled and logged

## Performance Requirements
- API calls must be optimized to minimize rate limiting
- Vector store operations must be efficient
- Data processing should handle large datasets without memory issues

## Error Handling
- All operations must include proper error handling
- Errors must be logged with appropriate context
- Failed operations must provide meaningful error messages
- Recovery mechanisms must be implemented where appropriate 