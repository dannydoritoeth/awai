# HubSpot Lead Scoring Guide

This guide explains how the AI-powered scoring system works with your HubSpot data.

## Overview

The system uses machine learning to:
1. Learn from your classified records
2. Find similar records when scoring
3. Apply consistent scoring criteria
4. Provide explanations for scores

## Training Data

### Classification
- Mark records as "Ideal" or "Less Ideal"
- Assign a score from 0-100
- Select relevant attributes
- Add explanatory notes

### Processing
- System creates embeddings for classified records
- Stores them in vector database
- Uses them as context for scoring

## Scoring Process

### Real-time Scoring
When a new record is created:
1. System generates embeddings
2. Finds similar records from training data
3. Uses AI to analyze similarities
4. Updates record with results

### Batch Scoring
Periodically processes updated records:
1. Identifies modified records
2. Applies same scoring process
3. Updates in bulk

## Best Practices

1. **Training Data Quality**
   - Provide diverse examples
   - Include both positive and negative cases
   - Keep classifications consistent
   - Add detailed notes

2. **Monitoring**
   - Review scoring results
   - Update training data as needed
   - Add more examples if scores seem incorrect

3. **Maintenance**
   - Regularly review training data
   - Update classifications as needed
   - Add new attributes when relevant

# HubSpot Lead Scoring System

## Features

### 1. Scoring Components
The lead score (0-100) is calculated using four weighted factors:
- **Lead Fit (30%)**: Match to ideal client profile
  - Industry alignment
  - Company size
  - Geographic location
  - Lead source
  - Lifecycle stage

- **Engagement (30%)**: Interaction metrics
  - Email opens and replies
  - Meeting attendance
  - Call completion
  - Total engagement count

- **Outcome (20%)**: Historical success patterns
  - Deal win rate
  - Average deal size
  - Sales cycle length
  - Industry performance

- **Recency (20%)**: Time-based activity
  - Last engagement date
  - Activity frequency
  - Response time

### 2. Priority Levels
Leads are categorized into three priority levels:
- **High Priority** (80-100): Immediate follow-up required
- **Medium Priority** (50-79): Regular nurturing needed
- **Low Priority** (0-49): Long-term nurturing

### 3. HubSpot Integration
The system updates the following custom fields in HubSpot:
- `ai_lead_score`: Numerical score (0-100)
- `ai_lead_fit`: Category (High/Medium/Low)
- `ai_close_probability`: Likelihood of closing (0-100%)
- `ai_next_best_action`: Recommended action (Follow-up/Nurture/Close)

### 4. Real-time Updates
- Scores are updated within 5 minutes of new activity
- Automatic workflow triggers for high-priority leads
- Bi-directional data sync with HubSpot

## Technical Implementation

### Environment Configuration
```env
# HubSpot Configuration
HUBSPOT_ACCESS_TOKEN=your_access_token
HUBSPOT_HIGH_PRIORITY_WORKFLOW_ID=your_workflow_id
HUBSPOT_PORTAL_ID=your_portal_id

# Lead Scoring Configuration
LEAD_SCORE_UPDATE_INTERVAL=300000 # 5 minutes
LEAD_SCORE_MIN_CONFIDENCE=0.7
LEAD_SCORE_RETRAIN_INTERVAL=604800000 # 7 days
LEAD_SCORE_MODEL_VERSION=1.0
```

### Data Sources
The system collects data from multiple HubSpot objects:
- Contacts: Lead details and profile data
- Companies: Industry and size information
- Deals: Historical performance and outcomes
- Engagements: Interaction history and activity

### AI Model
- Uses OpenAI GPT-4 for lead fit analysis
- Automatically adjusts weights based on performance
- Retrains every 7 days using latest data
- Includes fallback scoring for system resilience

## Security & Privacy

### Data Protection
- No PII stored in scoring database
- Only metadata and embeddings retained
- All data encrypted in transit and at rest
- OAuth 2.0 authentication with HubSpot

### Access Control
- **Sales Managers & Admins**: Full access to scores and metrics
- **Sales Representatives**: Access to priority levels only
- **Marketing Users**: Access to aggregate trends only

## Performance

### System Capabilities
- Handles up to 100,000 leads per month
- Response time under 2 seconds
- 99.9% uptime guarantee
- Auto-scaling support

### Error Handling
- Automatic retry for failed API calls (3 attempts)
- Fallback scoring mechanisms
- Error logging and admin notifications
- Graceful degradation to manual prioritization

## Success Metrics

### Target KPIs
- 20% increase in lead-to-close rate (90 days)
- 30% reduction in time-to-close for high-scoring leads
- Positive sales team feedback (monthly surveys)

### Monitoring
- Score distribution changes
- Model performance metrics
- API response times
- Error rates and types

## Integration Workflow

### Lead Scoring Process
1. New lead/activity triggers scoring
2. System gathers data from all sources
3. AI model calculates component scores
4. Final score and actions determined
5. HubSpot updated with results
6. Workflows triggered based on score

### Automated Actions
- High-priority lead notifications
- Sales rep assignments
- Nurturing campaign adjustments
- Activity tracking and logging

## Maintenance

### Regular Tasks
- Weekly model retraining
- Performance metric review
- Weight adjustment analysis
- Error log review

### System Health Checks
- API connectivity status
- Model performance metrics
- Data quality assessment
- Response time monitoring

## Troubleshooting

### Common Issues
1. **Score Not Updating**
   - Check API connectivity
   - Verify webhook delivery
   - Review error logs

2. **Incorrect Scores**
   - Validate input data
   - Check model weights
   - Review recent changes

3. **Performance Issues**
   - Monitor API rate limits
   - Check system resources
   - Review concurrent requests

## Support

### Contact Information
- Technical Support: [support@example.com]
- HubSpot Integration: [hubspot@example.com]
- Emergency Contact: [emergency@example.com]

### Documentation
- API Documentation: [link]
- HubSpot Custom Fields: [link]
- Workflow Configuration: [link] 