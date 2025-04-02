# Document Packager Output Examples

This document shows examples of how the DocumentPackager formats different types of HubSpot records, including their temporal progression data and related objects.

## Contact Example

```json
{
  "primary": {
    "title": "Contact 12345",
    "description": "Sales Manager in Technology Industry",
    "type": "contact",
    "classification": "Ideal",
    "score": 85,
    "notes": "Engaged consistently with our content and quick to respond"
  },
  "properties": {
    "industry": {
      "value": "Technology",
      "label": "Industry",
      "category": "business"
    },
    "jobtitle": {
      "value": "Sales Manager",
      "label": "Job Title",
      "category": "professional"
    }
  },
  "timeline": {
    "events": [
      {
        "timestamp": "2024-01-15T10:30:00Z",
        "type": "engagement",
        "description": "form_submission",
        "details": "Form submitted: Whitepaper Download"
      },
      {
        "timestamp": "2024-01-16T14:20:00Z",
        "type": "property_change",
        "description": "lifecyclestage changed",
        "oldValue": "subscriber",
        "newValue": "lead",
        "source": "workflow"
      },
      {
        "timestamp": "2024-01-18T09:15:00Z",
        "type": "engagement",
        "description": "page_view",
        "details": "Viewed page: /pricing"
      },
      {
        "timestamp": "2024-01-20T11:45:00Z",
        "type": "engagement",
        "description": "form_submission",
        "details": "Form submitted: Demo Request"
      },
      {
        "timestamp": "2024-01-20T11:46:00Z",
        "type": "property_change",
        "description": "lifecyclestage changed",
        "oldValue": "lead",
        "newValue": "opportunity",
        "source": "workflow"
      }
    ],
    "summary": {
      "firstInteraction": "2024-01-15T10:30:00Z",
      "lastInteraction": "2024-01-20T11:46:00Z",
      "totalInteractions": 5,
      "significantChanges": [
        "lifecyclestage: subscriber → lead",
        "lifecyclestage: lead → opportunity"
      ]
    }
  },
  "engagement": {
    "history": [
      {
        "type": "downloaded_content",
        "timestamp": "2024-01-15T10:30:00Z",
        "details": "Downloaded: AI Implementation Guide"
      },
      {
        "type": "visited_pricing",
        "timestamp": "2024-01-18T09:15:00Z",
        "details": "Viewed page: /pricing"
      },
      {
        "type": "requested_demo",
        "timestamp": "2024-01-20T11:45:00Z",
        "details": "Form submitted: Demo Request"
      }
    ],
    "metrics": {
      "totalEngagements": 3,
      "lastEngagement": "2024-01-20T11:45:00Z",
      "engagementTypes": [
        "downloaded_content",
        "visited_pricing",
        "requested_demo"
      ],
      "highValueActions": [
        "downloaded_content",
        "visited_pricing",
        "requested_demo"
      ]
    }
  }
}
```

## Deal Example (with Related Objects)

```json
{
  "primary": {
    "title": "Standard Deal",
    "description": "In Progress",
    "type": "deal",
    "classification": "Ideal",
    "score": 92,
    "notes": "Fast-moving enterprise deal with clear decision maker"
  },
  "properties": {
    "stage": {
      "value": "contract_sent",
      "label": "Stage",
      "category": "pipeline"
    },
    "pipeline": {
      "value": "enterprise",
      "label": "Pipeline",
      "category": "pipeline"
    },
    "type": {
      "value": "new_business",
      "label": "Type",
      "category": "pipeline"
    }
  },
  "relationships": {
    "company": [{
      "type": "primary",
      "id": "12345",
      "name": "Technology Company",
      "properties": {
        "industry": "Technology",
        "type": "Enterprise",
        "size_category": "Large",
        "training_score": 88
      }
    }],
    "contacts": [
      {
        "type": "decision_maker",
        "id": "67890",
        "name": "Contact 67890",
        "properties": {
          "jobtitle": "CTO",
          "training_score": 85
        }
      },
      {
        "type": "technical_buyer",
        "id": "67891",
        "name": "Contact 67891",
        "properties": {
          "jobtitle": "Engineering Manager",
          "training_score": 75
        }
      }
    ]
  },
  "timeline": {
    "events": [
      {
        "timestamp": "2024-02-01T09:00:00Z",
        "type": "property_change",
        "description": "dealstage changed",
        "oldValue": "appointment_scheduled",
        "newValue": "qualified_to_buy",
        "source": "user"
      },
      {
        "timestamp": "2024-02-05T15:30:00Z",
        "type": "engagement",
        "description": "meeting",
        "details": "Meeting: Product Demo with Team"
      },
      {
        "timestamp": "2024-02-10T14:00:00Z",
        "type": "property_change",
        "description": "dealstage changed",
        "oldValue": "qualified_to_buy",
        "newValue": "presentation_scheduled",
        "source": "user"
      },
      {
        "timestamp": "2024-02-15T16:45:00Z",
        "type": "property_change",
        "description": "dealstage changed",
        "oldValue": "presentation_scheduled",
        "newValue": "contract_sent",
        "source": "user"
      }
    ],
    "summary": {
      "firstInteraction": "2024-02-01T09:00:00Z",
      "lastInteraction": "2024-02-15T16:45:00Z",
      "totalInteractions": 4,
      "significantChanges": [
        "dealstage: appointment_scheduled → qualified_to_buy",
        "dealstage: qualified_to_buy → presentation_scheduled",
        "dealstage: presentation_scheduled → contract_sent"
      ]
    }
  },
  "engagement": {
    "history": [
      {
        "type": "meeting",
        "timestamp": "2024-02-05T15:30:00Z",
        "details": "Meeting: Product Demo with Team"
      },
      {
        "type": "email",
        "timestamp": "2024-02-12T10:15:00Z",
        "details": "Email: Proposal Follow-up"
      },
      {
        "type": "call",
        "timestamp": "2024-02-14T11:30:00Z",
        "details": "Call: Contract Discussion"
      }
    ],
    "metrics": {
      "totalEngagements": 3,
      "lastEngagement": "2024-02-14T11:30:00Z",
      "engagementTypes": [
        "meeting",
        "email",
        "call"
      ],
      "highValueActions": [
        "meeting"
      ]
    }
  }
}
```

## Key Features Demonstrated

1. **Record Type-Specific Training**
   - Training scores are consistent across types (>80 Ideal, <50 Less Ideal)
   - Notes reflect business value and fit for each type

2. **Temporal Progression**
   - Records show complete timeline of status changes
   - Captures progression through lifecycle stages/deal stages
   - Tracks velocity between stages
   - Shows engagement patterns over time

3. **High-Value Actions**
   - Content downloads
   - Pricing page visits
   - Demo requests
   - Meetings
   - Form submissions

4. **Privacy Considerations**
   - Personal identifiers removed (names, emails)
   - Company names anonymized
   - Deal amounts removed
   - Only job titles and industry information retained

5. **Engagement Metrics**
   - Total number of interactions
   - Types of engagement
   - First/last interaction dates
   - Significant status changes

This structured format allows the AI to:
- Analyze progression patterns specific to each record type
- Identify key indicators of success based on record-specific characteristics
- Understand engagement velocity in different contexts
- Learn from historical patterns while respecting type-specific characteristics
- Make predictions while respecting privacy 

## Key Features of Related Objects

1. **Bidirectional Relationships**
   - Deals show related company and contacts
   - Companies show related deals and contacts
   - Contacts show related company and deals

2. **Relationship Context**
   - Contact roles (decision_maker, technical_buyer, influencer)
   - Deal status (active, closed)
   - Primary vs secondary relationships

3. **Inherited Training Data**
   - Training scores from related objects
   - Helps identify patterns in successful relationships

4. **Privacy-Aware Related Data**
   - Maintains privacy controls across relationships
   - Only includes necessary identifying information
   - Preserves training and engagement data

This relationship structure allows the AI to:
- Analyze the full context of business relationships
- Identify patterns across related objects
- Understand the impact of relationships on success
- Learn from the complete business context
- Make predictions based on relationship patterns 