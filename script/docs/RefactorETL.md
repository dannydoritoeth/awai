# NSW Government Jobs ETL Refactoring Plan

## Important Note on Functionality

This refactoring plan is focused on code organization and maintainability while **preserving existing functionality**. The key points are:

- **No Functional Changes**: The ETL process will continue to work exactly as it does now
- **Same Data Flow**: The order of operations and data processing steps remain unchanged
- **Identical Outputs**: The final data structure and format will be the same
- **Existing Integrations**: All current integrations with Supabase, OpenAI, and other services remain as is
- **Business Logic**: Core business rules and processing logic stay the same

The main goals are:
1. Better code organization
2. Improved maintainability
3. Clearer separation of concerns
4. Enhanced testability
5. Better documentation

## Current Structure

The ETL process consists of three main components:

1. **runDaily.ts**
   - Entry point for the ETL process
   - Handles database connections setup
   - Orchestrates the spider and processor
   - Manages institution setup

2. **ETLProcessor.ts**
   - Processes job data
   - Handles database operations
   - Manages document processing
   - Performs AI analysis
   - Handles data migration

3. **nswGovJobs.js**
   - Web scraping functionality
   - Document handling
   - Initial data processing
   - Taxonomy processing
   - Database staging operations

## Current Issues

1. **Monolithic Spider Class**: The `NSWJobSpider` class (2700+ lines) handles:
   - Web scraping
   - Data processing
   - Database operations
   - Document handling
   - AI analysis
   - Taxonomy processing
   - Data validation
   - Migration between databases

2. **Tight Coupling**:
   - Direct database operations in spider
   - OpenAI integration mixed with scraping
   - Document processing embedded in spider
   - Staging/live database logic mixed

3. **Maintainability Challenges**:
   - Complex error handling across concerns
   - Duplicate database operations
   - Mixed responsibilities
   - Hard to modify individual features

## Refactoring Goals

1. **Separation of Concerns**: Split functionality into focused modules
2. **Improved Testability**: Enable unit testing of components
3. **Better Error Handling**: Consistent error handling
4. **Configuration Management**: Externalize configuration
5. **Dependency Injection**: Reduce tight coupling
6. **Type Safety**: Improve TypeScript usage

## Proposed Architecture

```
src/
├── config/
│   ├── database.ts
│   ├── openai.ts
│   └── spider.ts
├── models/
│   ├── job.ts
│   ├── role.ts
│   └── document.ts
├── services/
│   ├── spider/
│   │   ├── NSWJobSpider.ts        # Core scraping only
│   │   └── interfaces/
│   ├── processor/
│   │   ├── JobProcessor.ts        # Data processing
│   │   ├── DocumentProcessor.ts   # Document handling
│   │   └── interfaces/
│   ├── analyzer/
│   │   ├── AIAnalyzer.ts         # AI/OpenAI operations
│   │   ├── templates/            # NEW: AI Analysis prompts
│   │   │   ├── jobAnalysis.ts    # Job content analysis
│   │   │   ├── skillExtraction.ts # Skill extraction
│   │   │   ├── capabilityAnalysis.ts # Capability analysis
│   │   │   └── taxonomyAnalysis.ts # Taxonomy classification
│   │   └── interfaces/
│   ├── storage/
│   │   ├── DatabaseService.ts    # Database operations
│   │   └── interfaces/
│   ├── embeddings/               # Semantic search embeddings
│   │   ├── templates/
│   │   │   ├── jobTemplates.ts   # Job description templates
│   │   │   ├── roleTemplates.ts  # Role templates
│   │   │   └── skillTemplates.ts # Skill templates
│   │   ├── JobEmbedder.ts
│   │   └── interfaces/
│   └── orchestrator/
│       └── ETLOrchestrator.ts    # Replaces runDaily.ts
└── utils/
    ├── logger.ts
    ├── errors.ts
    └── validators.ts
```

## Code Documentation Headers

Each source file should include a standardized documentation header. Here are the templates for different file types:

### Service Class Header
```typescript
/**
 * @file [filename]
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * [Brief description of the service's responsibility]
 * 
 * @module services/[service-name]
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author [Your Team Name]
 * @version 1.0.0
 * @since [Date]
 * 
 * Key Responsibilities:
 * - [List main responsibilities]
 * 
 * Dependencies:
 * - [List key dependencies]
 * 
 * Usage:
 * ```typescript
 * [Example usage code]
 * ```
 */
```

### Interface Header
```typescript
/**
 * @file [filename]
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * [Brief description of what this interface represents]
 * 
 * @module interfaces
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author [Your Team Name]
 * @version 1.0.0
 * @since [Date]
 */
```

### Model Header
```typescript
/**
 * @file [filename]
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * [Brief description of what this model represents]
 * 
 * @module models
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author [Your Team Name]
 * @version 1.0.0
 * @since [Date]
 * 
 * Database Tables:
 * - [List related database tables]
 */
```

## Text Processing and Embeddings

### Job Description Processing

1. **Template Structure**
```typescript
// services/embeddings/templates/jobTemplates.ts

export const jobDescriptionTemplate = `
Role: {title}
Department: {department}
Location: {location}

Key Responsibilities:
{responsibilities}

Required Skills:
{skills}

Additional Information:
{additionalInfo}
`;

export const jobEmbeddingPrompt = `
Analyze this job posting for the NSW Government position.
Focus on:
1. Core responsibilities
2. Required skills and capabilities
3. Department-specific requirements
4. Level of seniority
5. Technical vs. managerial aspects
`;
```

2. **Role Template Structure**
```typescript
// services/embeddings/templates/roleTemplates.ts

export const roleTemplate = `
Position: {title}
Classification: {classification}
Department: {department}

Core Capabilities:
{capabilities}

Focus Areas:
{focusAreas}

Key Deliverables:
{deliverables}
`;

export const roleEmbeddingPrompt = `
Analyze this role description for the NSW Government position.
Focus on:
1. Core capabilities required
2. Level of responsibility
3. Key focus areas
4. Required outcomes
5. Organizational impact
`;
```

3. **Skill Template Structure**
```typescript
// services/embeddings/templates/skillTemplates.ts

export const skillTemplate = `
Skill: {name}
Category: {category}
Level Required: {level}

Description:
{description}

Application Context:
{context}
`;

export const skillEmbeddingPrompt = `
Analyze this skill requirement for NSW Government roles.
Focus on:
1. Technical vs. soft skill aspects
2. Required proficiency level
3. Practical application areas
4. Related capabilities
5. Industry relevance
`;
```

## AI Analysis Templates

### Job Content Analysis
```typescript
// services/analyzer/templates/jobAnalysis.ts

export const jobAnalysisPrompt = `
Analyze this job description and extract key information.
Consider:
1. Primary job responsibilities
2. Required experience level
3. Technical requirements
4. Soft skills needed
5. Team structure and reporting lines

Format the response as:
{
  "responsibilities": string[],
  "experienceLevel": "junior" | "mid" | "senior" | "executive",
  "technicalRequirements": string[],
  "softSkills": string[],
  "teamStructure": {
    "reportsTo": string,
    "manages": string[]
  }
}
`;

export const jobSummaryPrompt = `
Create a concise summary of this job posting.
Include:
1. Key role objectives
2. Essential requirements
3. Unique aspects of the role
4. Department context

Maximum length: 250 words
`;
```

### Skill Extraction
```typescript
// services/analyzer/templates/skillExtraction.ts

export const skillExtractionPrompt = `
Extract all skills mentioned in this job description.
Categorize them as:
1. Technical Skills
2. Soft Skills
3. Domain Knowledge
4. Certifications
5. Tools & Technologies

For each skill, indicate:
- Required vs Preferred
- Experience level needed
- Context of usage

Format as JSON with schema:
{
  "technicalSkills": Array<{
    "name": string,
    "required": boolean,
    "experienceLevel": string,
    "context": string
  }>,
  // ... similar for other categories
}
`;
```

### Capability Analysis
```typescript
// services/analyzer/templates/capabilityAnalysis.ts

export const capabilityExtractionPrompt = `
Analyze this content for NSW Government Capability Framework alignments.
Consider the 16 core capabilities across:
1. Personal Attributes
2. Relationships
3. Results
4. Business Enablers

For each identified capability:
1. Note the required level (Foundational to Highly Advanced)
2. Extract supporting evidence from the text
3. Identify behavioral indicators

Format as JSON with schema:
{
  "capabilities": Array<{
    "name": string,
    "group": string,
    "level": string,
    "evidence": string[],
    "behaviors": string[]
  }>
}
`;
```

### Taxonomy Analysis
```typescript
// services/analyzer/templates/taxonomyAnalysis.ts

export const taxonomyClassificationPrompt = `
Classify this job according to the NSW Government Job Classification framework.
Consider:
1. Occupation Category
2. Job Family
3. Job Function
4. Grade/Level
5. Specialization

Also identify:
- Similar roles in other departments
- Career progression paths
- Related capabilities

Format as JSON with schema:
{
  "classification": {
    "category": string,
    "family": string,
    "function": string,
    "grade": string,
    "specialization": string[]
  },
  "relatedRoles": string[],
  "careerPath": {
    "previous": string[],
    "next": string[]
  }
}
`;
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. **Project Structure**
   - Create new directory structure
   - Setup TypeScript configuration
   - Configure testing framework
   - Move existing files to new structure
   - Add documentation headers to all files
   - Create embedding templates

2. **Configuration Management**
   ```typescript
   // config/database.ts
   export interface DatabaseConfig {
     supabaseUrl: string;
     supabaseKey: string;
     stagingUrl: string;
     stagingKey: string;
   }

   // config/spider.ts
   export interface SpiderConfig {
     baseUrl: string;
     maxJobs: number;
     rateLimitDelay: number;
   }
   ```

### Phase 2: Core Models (Week 1-2)

1. **Define Data Models**
   ```typescript
   // models/job.ts
   export interface Job {
     id: string;
     title: string;
     department: string;
     location: string;
     salary: string;
     closingDate: Date;
     sourceUrl: string;
     documents?: Document[];
   }

   // models/document.ts
   export interface Document {
     id: string;
     url: string;
     type: string;
     content?: string;
     jobId: string;
   }
   ```

### Phase 3: Spider Service (Week 2-3)

1. **Extract Core Spider Functionality**
   ```typescript
   // services/spider/NSWJobSpider.ts
   export class NSWJobSpider {
     constructor(
       private config: SpiderConfig,
       private logger: Logger
     ) {}

     async launch(): Promise<Job[]>;
     private async scrapeJobs(): Promise<Job[]>;
     private async scrapeJobDetails(jobId: string): Promise<JobDetails>;
   }
   ```

2. **Create Document Service**
   ```typescript
   // services/processor/DocumentProcessor.ts
   export class DocumentProcessor {
     constructor(
       private storage: StorageService,
       private logger: Logger
     ) {}

     async processDocument(doc: Document): Promise<ProcessedDocument>;
     async extractText(buffer: Buffer): Promise<string>;
   }
   ```

### Phase 4: Storage Service (Week 3-4)

1. **Database Operations Layer**
   ```typescript
   // services/storage/DatabaseService.ts
   export class DatabaseService {
     constructor(
       private config: DatabaseConfig,
       private logger: Logger
     ) {}

     async upsertJob(job: Job): Promise<Job>;
     async stageJob(job: Job): Promise<void>;
     async migrateToLive(jobId: string): Promise<void>;
   }
   ```

### Phase 5: AI Analysis Service (Week 4)

1. **Extract AI Operations**
   ```typescript
   // services/analyzer/AIAnalyzer.ts
   export class AIAnalyzer {
     constructor(
       private openai: OpenAI,
       private logger: Logger
     ) {}

     async analyzeJobDescription(content: string): Promise<Analysis>;
     async extractCapabilities(content: string): Promise<Capability[]>;
     async extractSkills(content: string): Promise<Skill[]>;
   }
   ```

### Phase 6: ETL Orchestrator (Week 5)

1. **Create Orchestrator**
   ```typescript
   // services/orchestrator/ETLOrchestrator.ts
   export class ETLOrchestrator {
     constructor(
       private spider: NSWJobSpider,
       private processor: JobProcessor,
       private storage: DatabaseService,
       private logger: Logger
     ) {}

     async runDaily(): Promise<void> {
       // Initialize connections
       // Run spider
       // Process jobs
       // Handle errors
     }
   }
   ```

## Testing Strategy

1. **Unit Tests**
   - Test each service in isolation
   - Mock external dependencies
   - Test error handling

2. **Integration Tests**
   - Test service interactions
   - Test database operations
   - Test complete ETL flow

3. **E2E Tests**
   - Test full ETL process
   - Validate data integrity
   - Test error recovery

## Migration Strategy

1. **Gradual Migration**
   - Start with storage layer
   - Move spider functionality
   - Implement new services
   - Switch to new orchestrator

2. **Parallel Running**
   - Run old and new systems
   - Compare results
   - Validate data integrity

## Success Metrics

1. **Code Quality**
   - Reduced file sizes
   - Better type coverage
   - Improved test coverage

2. **Maintainability**
   - Isolated components
   - Clear interfaces
   - Better error handling

3. **Performance**
   - Faster processing
   - Better resource usage
   - Reduced errors

## Timeline

- Week 1: Infrastructure & Models
- Week 2-3: Spider & Document Services
- Week 3-4: Storage Service
- Week 4: AI Analysis Service
- Week 5: Orchestrator & Testing
- Week 6: Migration & Validation
