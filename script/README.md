# Government Job Vacancy Scraper

A Node.js-based web scraper and data processing pipeline for collecting, processing, and intelligently extracting structured data from government job vacancy postings. Supports multi-tenant seed data generation with Supabase integration.

## Features

- Scrapes vacancies from NSW Government and Seek.
- Downloads and extracts content from PDF/Word documents using `pdf2json` and `mammoth`.
- Uses OpenAI to extract structured data according to the MCP schema.
- Generates multi-tenant seed JSON files for core tables (`companies`, `divisions`, `roles`, `jobs`, `capabilities`, `skills`, etc.) with `company_id`.
- Inserts seed data into Supabase with duplicate-handling upserts.
- Detailed progress and debug logging throughout the pipeline.

## Prerequisites

- Node.js v18+ and npm
- A Supabase project (URL and service role key)
- OpenAI API key

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Kebalepile/government_vacancy_scrapper.git
   cd government_vacancy_scrapper
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy and update environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set:
   ```ini
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   ```
4. Ensure `.env.local` is listed in `.gitignore`.

## Usage

### 1. Scrape job postings

```bash
npm run scrape
# or
node scripts/scrape-all.js
```

Scrapes NSW Government and Seek job postings and writes JSON files to `database/jobs/` (e.g. `nswgov-YYYY-MM-DD.json`, `seek-YYYY-MM-DD.json`).

### 2. Download and process documents

```bash
npm run process-documents
# or
node scripts/process-documents.js
```

Downloads linked documents to `database/jobs/files/`, extracts text content, and uses AI to generate structured JSON in `database/documents/`.

### 3. Prepare seed data

```bash
npm run prepare-seed
# or
node scripts/prepareSeedData.js
```

Generates seed JSON files in `database/seed/`, adding `company_id` to core tables for multi-tenancy.

### 4. Insert seed data into Supabase

```bash
node scripts/insertSeedData.js
```

Reads seed files from `database/seed/` and upserts them into Supabase, handling duplicates appropriately.

## Directory Structure

```
.[0m
├── database
│   ├── jobs/           # Raw scraped job JSON
│   ├── documents/      # Extracted document JSON
│   └── seed/           # Generated seed JSON for insertion
├── scripts
│   ├── scrape-all.js         # Runs all spiders
│   ├── process-documents.js  # Document download & extraction
│   ├── prepareSeedData.js    # Generates seed files
│   └── insertSeedData.js     # Inserts seed data into Supabase
├── spiders
│   ├── nswGovJobs.js # NSW Gov scraper
│   └── seekJobs.js   # Seek scraper
├── utils
│   └── documentProcessor.js  # Handles document extraction & AI processing
├── .env.example
├── package.json
└── README.md
```

## Multi-Tenancy

Seed data now includes a `company_id` on all core tables (`roles`, `jobs`, `capabilities`, `skills`, etc.), enabling support for multiple clients in the same database schema.

## Contributing & License

Contributions welcome via GitHub PRs and issues.  
Licensed under the MIT License.


-- Example: enable the "vector" extension.
create extension vector
with
  schema extensions;
-- Example: disable the "vector" extension
drop
  extension if exists vector;


supabase db dump --schema public > schema.sql