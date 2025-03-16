# HubSpot Process Training

This document explains how to use the process training functionality in the Sales Copilot application. The training process helps the AI model understand what makes an ideal client, company, or deal for your organization.

## Training Fields

The following training fields are created during OAuth installation for each object type:

### Contacts
- `training_classification` (select): "Ideal" or "Less Ideal"
- `training_score` (number): Score from 0-100
- `training_attributes` (checkbox): Multiple attributes that characterize the contact
- `training_notes` (textarea): Additional context about why this contact is ideal or not

### Companies
- `training_classification` (select): "Ideal" or "Less Ideal"
- `training_score` (number): Score from 0-100
- `training_attributes` (checkbox): Multiple attributes that characterize the company
- `training_notes` (textarea): Additional context about why this company is ideal or not

### Deals
- `training_classification` (select): "Ideal" or "Less Ideal"
- `training_score` (number): Score from 0-100
- `training_attributes` (checkbox): Multiple attributes that characterize the deal
- `training_notes` (textarea): Additional context about why this deal is ideal or not

## Training Process

1. **Select Training Records**
   - Identify 10-20 examples each of ideal and less ideal records for each object type
   - Choose records that clearly represent what makes a good or poor fit for your organization

2. **Fill Training Fields**
   - Navigate to the record in HubSpot
   - Locate the "AI Scoring" section
   - Fill out all training fields:
     - Set classification as "Ideal" or "Less Ideal"
     - Provide a score (higher scores for better fits)
     - Select relevant attributes
     - Add detailed notes explaining the classification

3. **Run Training**
   ```bash
   # From the project root
   supabase functions deploy hubspot-train-model
   supabase functions invoke hubspot-train-model --body '{"portalId": "YOUR_PORTAL_ID"}'
   ```

4. **Verify Training**
   - After training completes, the model will start scoring new records
   - Check a few scored records to verify the results align with your expectations
   - Scores and summaries are stored in:
     - Contacts: `ideal_client_score`, `ideal_client_summary`
     - Companies: `company_fit_score`, `company_fit_summary`
     - Deals: `deal_quality_score`, `deal_quality_summary`

## Best Practices

1. **Diverse Examples**
   - Include a variety of reasons why records are ideal or not
   - Cover different industries, sizes, and scenarios
   - Include edge cases that help define boundaries

2. **Detailed Notes**
   - Provide specific reasons in the training notes
   - Include both positive and negative factors
   - Mention any special circumstances or context

3. **Regular Updates**
   - Periodically review and update training data
   - Add new examples as your ideal customer profile evolves
   - Retrain the model when significant changes are made

## Troubleshooting

If the model's scoring doesn't align with expectations:
1. Review training data for consistency
2. Add more diverse examples
3. Ensure training notes are detailed and specific
4. Retrain the model with updated examples

## Support

For issues or questions about the training process:
1. Check the function logs in Supabase
2. Review the training data in HubSpot
3. Contact support with specific examples of unexpected results 