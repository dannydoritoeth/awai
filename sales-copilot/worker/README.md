# Ideal Client Analysis Service

This service helps analyze and categorize clients using HubSpot data and AI-powered similarity matching.

## Setup

1. Configure your environment variables in `.env.example`:
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
```

Note: In HubSpot, the `client_id` is the same as your `app_id`. You can find this in your HubSpot Developer account under "Apps" → Your App → "Auth" tab.

After updating `.env.example`, create your `.env` file with your actual values:

```bash
cp .env.example .env
```

Would you like me to provide any additional clarification about the configuration?

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