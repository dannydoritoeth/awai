# HubSpot Installation Guide

This guide explains how to install and configure Sales Copilot in your HubSpot portal.

## Prerequisites

- HubSpot account with admin access
- Supported HubSpot plan (Professional or Enterprise)

## Installation Steps

1. **Install the App**
   - Visit the HubSpot marketplace
   - Search for "Sales Copilot"
   - Click "Install App"

2. **OAuth Setup**
   - Follow the OAuth authorization flow
   - Grant required permissions
   - The app will create necessary properties:
     - `training_classification` (Ideal/Less Ideal)
     - `training_attributes` (Characteristics)
     - `training_score` (0-100)
     - `training_notes` (Context)

3. **Verify Installation**
   - Check that properties were created
   - Verify OAuth connection
   - Test access to your portal

## Next Steps

- [Set Up Training Data](training.md)
- [Configure Scoring](scoring.md)

## Troubleshooting

If you encounter any issues during installation:
1. Verify your HubSpot permissions
2. Check that all properties were created
3. Contact support if needed