# Sales Copilot for HubSpot

Sales Copilot is an AI-powered tool that helps you identify and score ideal clients in your HubSpot CRM.

## Features

- Automatic scoring of new contacts, companies, and deals
- Daily batch scoring of modified records
- AI-generated summaries explaining the scores
- Customizable scoring criteria and AI models
- Rate-limited API usage to comply with HubSpot's requirements

## Installation

1. Install the app from HubSpot Marketplace
2. Authorize the app with the following required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `properties.read`
   - `properties.write`

3. The app will automatically:
   - Create required property groups
   - Set up scoring properties
   - Configure initial AI settings

## Configuration

### AI Settings

Configure your AI settings in the app settings:

- **Provider**: Choose between OpenAI, Anthropic, or Google
- **Model**: Select the AI model to use
- **Temperature**: Set the creativity level (0.0 - 1.0)
- **Max Tokens**: Set the maximum response length
- **Scoring Prompt**: Customize the scoring criteria

### Properties

The app creates the following properties in HubSpot:

- **Ideal Client Score** (0-100)
  - Type: Number
  - Group: Ideal Client Fit
  - Description: AI-generated score indicating fit

- **Ideal Client Summary**
  - Type: Text Area
  - Group: Ideal Client Fit
  - Description: AI explanation of the score

- **Last Scored At**
  - Type: Date/Time
  - Group: Ideal Client Fit
  - Description: When the record was last scored

## Usage

### Automatic Scoring

Records are automatically scored when:
- A new contact, company, or deal is created
- The daily batch process runs (midnight UTC)
- Manual scoring is triggered via the app

### Viewing Scores

Find scores and summaries:
1. Open any contact, company, or deal
2. Look for the "Ideal Client Fit" property group
3. View the score and AI-generated summary

### Batch Processing

The app automatically processes:
- Records modified in the last 24 hours
- 100 records at a time (rate-limited)
- All active HubSpot accounts

## Troubleshooting

### Common Issues

1. **Missing Properties**
   - The app validates properties on startup
   - Properties are recreated if missing
   - Check property group permissions

2. **Rate Limits**
   - The app respects HubSpot's rate limits
   - Batch processing may take longer during high load
   - Failed requests are automatically retried

3. **Scoring Errors**
   - Check the scoring prompt configuration
   - Verify AI provider settings
   - Review error messages in the app logs

## Support

For support:
1. Check the troubleshooting guide
2. Contact support@salescopilot.ai
3. Visit our [support portal](https://support.salescopilot.ai)

## Updates

The app automatically:
- Validates and updates properties
- Handles API version changes
- Maintains rate limit compliance 