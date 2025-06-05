# NSW Government Jobs ETL

A comprehensive ETL (Extract, Transform, Load) pipeline for NSW Government job listings.

## Features

- Web scraping of job listings from iworkfor.nsw.gov.au
- AI-powered analysis of job descriptions
- Capability and taxonomy extraction
- Embedding generation for semantic search
- Supabase integration for data storage
- Batch processing with concurrency control
- Comprehensive error handling and retry mechanisms
- Progress tracking and metrics collection
- Interactive CLI interface

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Build the project:
```bash
npm run build
```

## Configuration

Create a `.env` file with the following variables:

```env
# Spider Configuration
NSW_JOBS_URL=https://iworkfor.nsw.gov.au
USER_AGENT=NSW Jobs ETL Bot

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview
EMBEDDING_MODEL=text-embedding-3-small

# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key

# Database Tables
JOBS_TABLE=jobs
CAPABILITIES_TABLE=capabilities
EMBEDDINGS_TABLE=embeddings
TAXONOMY_TABLE=taxonomy

# Performance Configuration
BATCH_SIZE=10
MAX_CONCURRENCY=5
RETRY_ATTEMPTS=3
RETRY_DELAY=1000
POLL_INTERVAL=5000

# Logging Configuration
LOG_LEVEL=info
LOG_PATH=logs
```

## CLI Usage

The ETL pipeline can be controlled through the command-line interface:

```bash
# Run the pipeline
npm start run [options]

# Check pipeline status
npm start status

# Stop the pipeline
npm start stop

# Pause the pipeline
npm start pause

# Resume the pipeline
npm start resume

# Show help
npm start help
```

### Pipeline Options

- `-c, --config <path>`: Path to config file (default: .env)
- `-l, --log <path>`: Path to log directory (default: logs)
- `-o, --output <path>`: Path to output directory (default: output)
- `-i, --interactive`: Enable interactive mode (default: true)
- `-s, --start-date <date>`: Start date for job scraping (YYYY-MM-DD)
- `-e, --end-date <date>`: End date for job scraping (YYYY-MM-DD)
- `-a, --agencies <agencies...>`: Filter by agencies
- `-l, --locations <locations...>`: Filter by locations
- `--skip-processing`: Skip job processing
- `--skip-storage`: Skip job storage
- `--continue-on-error`: Continue pipeline on errors

## Architecture

The ETL pipeline is composed of several services:

1. **Spider Service**: Scrapes job listings and details from the NSW Government jobs website
2. **Processor Service**: Analyzes job descriptions and generates embeddings
3. **Storage Service**: Stores processed data in Supabase
4. **Orchestrator Service**: Coordinates all services and manages the pipeline
5. **CLI Service**: Provides command-line interface for pipeline control

## Development

### Project Structure

```
src/
├── cli/                 # CLI interface
├── services/           
│   ├── analyzer/       # AI analysis service
│   ├── embeddings/     # Embedding generation service
│   ├── orchestrator/   # Pipeline orchestration
│   ├── processor/      # Job processing service
│   ├── spider/         # Web scraping service
│   └── storage/        # Data storage service
├── utils/              # Utility functions
└── __tests__/         # Test files
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 