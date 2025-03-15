# Supabase Project Requirements Document

## Overview
The Supabase project provides the backend infrastructure for the Sales Copilot application, including database management, authentication, and serverless functions for HubSpot integration. This document outlines the core functionality and requirements that must be maintained.

## Database Structure

### 1. HubSpot Accounts Table
- **Table Name**: `hubspot_accounts`
- **Primary Key**: UUID (auto-generated)
- **Required Fields**:
  - `portal_id`: TEXT (UNIQUE)
  - `access_token`: TEXT
  - `refresh_token`: TEXT
  - `expires_at`: TIMESTAMP WITH TIME ZONE
  - `status`: TEXT (ENUM: 'active', 'inactive', 'error')
  - `token_type`: TEXT (DEFAULT: 'bearer')
- **Optional Fields**:
  - `last_sync_at`: TIMESTAMP WITH TIME ZONE
  - `error_message`: TEXT
  - `metadata`: JSONB
- **Auto-managed Fields**:
  - `created_at`: TIMESTAMP WITH TIME ZONE
  - `updated_at`: TIMESTAMP WITH TIME ZONE (auto-updated via trigger)
- **Indexes**:
  - `idx_hubspot_accounts_portal_id`
  - `idx_hubspot_accounts_status`

### 2. Scoring Fields
- Additional fields for storing scoring-related data
- Must maintain data integrity and relationships

### 3. AI Configuration
- Storage for AI-related configuration and settings
- Must support flexible configuration options

## Edge Functions

### 1. HubSpot OAuth Function
- **Purpose**: Handle HubSpot OAuth flow and token management
- **Required Functionality**:
  - OAuth token exchange
  - Token refresh mechanism
  - Secure token storage
  - Error handling and logging
  - Rate limiting compliance

### 2. HubSpot Score Record Function
- **Purpose**: Process individual HubSpot records for scoring
- **Required Functionality**:
  - Record validation
  - Scoring calculation
  - Result storage
  - Error handling

### 3. HubSpot Score Batch Function
- **Purpose**: Process multiple HubSpot records in batch
- **Required Functionality**:
  - Batch processing
  - Progress tracking
  - Error handling and recovery
  - Rate limiting management

### 4. HubSpot Process Training Function
- **Purpose**: Process and prepare data for AI training
- **Required Functionality**:
  - Data preparation
  - Feature extraction
  - Training data validation
  - Error handling

### 5. CRM Card Function
- **Purpose**: Generate and manage CRM cards
- **Required Functionality**:
  - Card generation
  - Data formatting
  - Template management
  - Error handling

## Security Requirements

### 1. Authentication
- Must implement secure authentication mechanisms
- Must handle token refresh securely
- Must protect sensitive data
- Must implement proper access controls

### 2. Data Protection
- Must encrypt sensitive data at rest
- Must secure data in transit
- Must implement proper key management
- Must handle data deletion securely

### 3. Access Control
- Must implement row-level security
- Must enforce proper permissions
- Must audit access patterns
- Must handle role-based access

## Performance Requirements

### 1. Database Performance
- Must maintain efficient indexes
- Must optimize query performance
- Must handle concurrent connections
- Must implement proper connection pooling

### 2. Function Performance
- Must optimize cold starts
- Must handle concurrent requests
- Must implement proper caching
- Must manage resource usage

## Error Handling

### 1. Database Errors
- Must handle connection errors
- Must implement retry mechanisms
- Must log errors appropriately
- Must maintain data consistency

### 2. Function Errors
- Must handle API errors gracefully
- Must implement proper error responses
- Must log errors with context
- Must implement recovery mechanisms

## Monitoring and Logging

### 1. Database Monitoring
- Must track query performance
- Must monitor connection usage
- Must track error rates
- Must implement alerting

### 2. Function Monitoring
- Must track execution times
- Must monitor error rates
- Must track resource usage
- Must implement alerting

## Deployment Requirements

### 1. Database Migrations
- Must maintain version control
- Must handle rollbacks
- Must preserve data integrity
- Must document changes

### 2. Function Deployment
- Must handle zero-downtime deployments
- Must implement proper versioning
- Must handle environment variables
- Must implement proper testing

## Testing Requirements

### 1. Database Testing
- Must test migrations
- Must test constraints
- Must test triggers
- Must test performance

### 2. Function Testing
- Must implement unit tests
- Must implement integration tests
- Must test error scenarios
- Must test performance

## Dependencies
- Supabase Platform
- Deno Runtime
- HubSpot API
- Vector Store
- Encryption Libraries

## Version Compatibility
- Must maintain backward compatibility
- Must version all changes
- Must document breaking changes
- Must implement proper migration paths 