# Ideal Client Analysis Service

This service analyzes and scores clients using HubSpot data, embeddings, and AI-powered similarity matching.

## Setup

1. Configure your environment variables in `.env`:
```env
# HubSpot OAuth Configuration
HUBSPOT_CLIENT_ID=your_app_id        # This is your HubSpot App ID
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=https://your-project.supabase.co/functions/v1/hubspot-oauth
HUBSPOT_SCOPES="contacts crm.objects.contacts.read crm.objects.contacts.write"

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_environment

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. Create your `.env` file:
```bash
cp .env.example .env
```

## Available Scripts

### 1. Process Ideal Client Lists
This script loads your ideal and less-ideal client lists from HubSpot and stores them in Pinecone for future matching. The script will automatically fetch the HubSpot access token from the database using the provided portal ID.

```bash
node src/scripts/processIdealClients.js --portal_id=YOUR_PORTAL_ID
```

Example:
```bash
node src/scripts/processIdealClients.js --portal_id=12345
```

Output will show the processing results:
```javascript
{
    contacts: {
        ideal: { processed: 50, successful: 48 },
        lessIdeal: { processed: 30, successful: 29 }
    },
    companies: {
        ideal: { processed: 20, successful: 20 },
        lessIdeal: { processed: 15, successful: 15 }
    }
}
```

### 2. Run Batch Scoring
This script scores recently modified records against your ideal client profile. The script will automatically fetch the HubSpot access token from the database using the provided portal ID.

```bash
node src/scripts/batchScoring.js --portal_id=YOUR_PORTAL_ID
```

Example:
```bash
node src/scripts/batchScoring.js --portal_id=12345
```

Output format:
```javascript
{
    processed: 10,    // Total records processed
    successful: 9,    // Successfully scored records
    failed: 1,        // Failed records
    errors: [{        // Details of any errors
        recordId: "123",
        error: "Error message"
    }]
}
```

Each scored record in HubSpot will be updated with:
- `ideal_client_score`: 0-100 score
- `ideal_client_classification`: Classification category
- `ideal_client_analysis`: Detailed analysis
- `ideal_client_last_scored`: Timestamp

## Running on a Schedule

To run the scoring process automatically, you can set up a cron job:

```bash
# Run daily at midnight for specific portal
0 0 * * * cd /path/to/worker && node src/scripts/batchScoring.js --portal_id=12345
```

The script maintains a timestamp of its last run and will only process records modified since then.

## Usage Examples

### 1. Process Ideal Client Lists from HubSpot

```javascript
const idealClientService = require('./services/idealClientService');
const HubspotClient = require('./integrations/hubspot/client');

async function processIdealClients(accessToken) {
    const hubspotClient = new HubspotClient(accessToken);
    
    // Process contacts
    const contactResults = await idealClientService.processHubSpotLists(hubspotClient, 'contacts');
    console.log('Contact Processing Results:', contactResults.summary);

    // Process companies
    const companyResults = await idealClientService.processHubSpotLists(hubspotClient, 'companies');
    console.log('Company Processing Results:', companyResults.summary);
}
```

### 2. Analyze a Single Client

```javascript
const client = {
    id: '12345',
    firstName: 'John',
    lastName: 'Doe',
    company: {
        name: 'Acme Inc',
        industry: 'Technology'
    },
    engagementMetrics: {
        emailsOpened: 10,
        meetingsAttended: 5
    },
    dealHistory: {
        totalDeals: 3,
        wonDeals: 2
    }
};

const analysis = await idealClientService.analyzeClientFit(client, 'contacts');
console.log('Analysis Results:', analysis);
/* Output:
{
    score: 75.5,
    classification: "Moderately Ideal",
    analysis: "Client fit score: 75.5%...",
    similarClients: {
        ideal: [...],
        lessIdeal: [...]
    },
    metrics: {
        totalSimilar: 10,
        idealCount: 7,
        lessIdealCount: 3
    }
}
*/
```

### 3. Store Individual Client Data

```javascript
const result = await idealClientService.storeIdealClientData(
    clientData,
    'contacts',  // or 'companies'
    'ideal'      // or 'less_ideal'
);
console.log('Storage Result:', result);
/* Output:
{
    stored: true,
    type: 'contacts',
    label: 'ideal',
    id: '12345',
    vectorId: 'contacts_12345_ideal'
}
*/
```

### 4. Find Similar Clients

```javascript
const similarClients = await idealClientService.findSimilarClients(
    clientData,
    'contacts',  // or 'companies'
    5           // limit (optional, default: 5)
);
console.log('Similar Clients:', similarClients);
```

## Response Types

### Analysis Response
```typescript
interface AnalysisResponse {
    score: number;              // 0-100 score indicating ideal client fit
    classification: string;     // "Strongly Ideal" | "Moderately Ideal" | "Neutral" | 
                               // "Moderately Less-Ideal" | "Strongly Less-Ideal"
    analysis: string;          // Detailed analysis text
    similarClients: {
        ideal: Array<ClientMatch>;
        lessIdeal: Array<ClientMatch>;
    };
    metrics: {
        totalSimilar: number;
        idealCount: number;
        lessIdealCount: number;
    };
}
```

### Processing Response
```typescript
interface ProcessingResponse {
    success: boolean;
    type: string;
    summary: {
        ideal: {
            processed: number;
            successful: number;
        };
        lessIdeal: {
            processed: number;
            successful: number;
        };
    };
    details: {
        ideal: Array<StorageResult>;
        lessIdeal: Array<StorageResult>;
    };
}
```

## Error Handling

All methods throw errors for invalid inputs or processing failures. Always wrap calls in try-catch blocks:

```javascript
try {
    const result = await idealClientService.analyzeClientFit(client, 'contacts');
    console.log('Analysis successful:', result);
} catch (error) {
    console.error('Analysis failed:', error.message);
}
```

## Best Practices

1. Always validate client data before passing it to the service
2. Use the appropriate type ('contacts' or 'companies') consistently
3. Handle errors appropriately in your application
4. Monitor the analysis scores and adjust your ideal client criteria as needed 