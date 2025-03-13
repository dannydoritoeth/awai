# Sales Copilot Shared Library

This shared library contains common functionality used by both the Node.js backend and Supabase Edge Functions in the Sales Copilot application.

## Features

- HubSpot client for interacting with the HubSpot API
- Ideal client service for processing and storing ideal client data
- Common types and utilities
- Cross-platform compatibility (Node.js and Deno)

## Installation

### For Node.js projects

```bash
# From the root of your Node.js project
npm install ../shared
```

Or add to your package.json:

```json
"dependencies": {
  "sales-copilot-shared": "file:../shared"
}
```

### For Deno projects

Import directly in your code:

```typescript
import { HubspotClient, IdealClientService, logger } from '../shared/src/index.ts';
```

## Usage

### HubSpot Client

```typescript
import { HubspotClient } from 'sales-copilot-shared';

// Create a new HubSpot client
const hubspotClient = new HubspotClient('your-access-token');

// Find a list by name
const list = await hubspotClient.findListByName('Ideal-Contacts');

// Get contacts from a list
const contacts = await hubspotClient.getContactsFromList(list.id);

// Get ideal and less-ideal data
const data = await hubspotClient.getIdealAndLessIdealData('contacts');
```

### Ideal Client Service

```typescript
import { IdealClientService, HubspotClient } from 'sales-copilot-shared';

// Create a new HubSpot client
const hubspotClient = new HubspotClient('your-access-token');

// Create a new Ideal Client Service
const idealClientService = new IdealClientService();

// Set up vector store (optional)
idealClientService.setVectorStore(yourVectorStore, 'your-namespace');

// Process HubSpot lists
const result = await idealClientService.processHubSpotLists(hubspotClient, 'contacts');

// Store individual client data
const storeResult = await idealClientService.storeIdealClientData(
  contactData, 
  'contacts', 
  'ideal'
);
```

### Logger

```typescript
import { logger } from 'sales-copilot-shared';

// Log information
logger.info('This is an info message', { additionalData: 'value' });

// Log errors
logger.error('This is an error message', new Error('Something went wrong'));
```

## Development

### Building the library

```bash
# Install dependencies
npm install

# Build the library
npm run build
```

### Running tests

```bash
npm test
```

## License

This project is proprietary and confidential. Unauthorized copying, transferring, or reproduction of the contents of this project, via any medium, is strictly prohibited. 