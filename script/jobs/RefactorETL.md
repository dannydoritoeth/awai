# NSW Government Jobs ETL Refactoring Plan

## Current Issues

1. **Monolithic Structure**: The `NSWJobSpider` class is over 2700 lines long and handles too many responsibilities:
   - Web scraping
   - Data processing
   - Database operations
   - Document handling
   - AI analysis
   - Taxonomy processing
   - Data validation
   - Migration between databases

2. **Tight Coupling**: The class is tightly coupled with:
   - Supabase database
   - OpenAI API
   - Specific data structures
   - Document processing logic

3. **Maintainability Challenges**:
   - Hard to modify one feature without affecting others
   - Difficult to test individual components
   - Complex error handling across different concerns
   - Duplicate code patterns
   - Mixed levels of abstraction

## Refactoring Goals

1. **Separation of Concerns**: Split functionality into focused, single-responsibility modules
2. **Improved Testability**: Enable unit testing of individual components
3. **Better Error Handling**: Consistent error handling across modules
4. **Configuration Management**: Externalize configuration
5. **Dependency Injection**: Reduce tight coupling
6. **Type Safety**: Improve TypeScript usage and type definitions

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
│   ├── capability.ts
│   └── skill.ts
├── services/
│   ├── spider/
│   │   ├── NSWJobSpider.ts
│   │   └── interfaces/
│   ├── processor/
│   │   ├── JobProcessor.ts
│   │   ├── ProcessorOrchestrator.ts
│   │   └── interfaces/
│   ├── analyzer/
│   │   ├── AIAnalyzer.ts
│   │   └── interfaces/
│   └── storage/
│       ├── DatabaseService.ts
│       └── interfaces/
├── utils/
│   ├── logger.ts
│   ├── errors.ts
│   └── validators.ts
└── types/
    └── common.ts
```

## Code Cleanup Plan

### Phase 0: Code Audit (Week 1)

1. **Identify Unused Files**
   - Run static analysis tools to find unused imports and files
   - Create dependency graphs to visualize code relationships
   - Document all files that appear to be unused

2. **Analyze Current Usage**
   ```
   Current Structure:
   script/
   ├── jobs/
   │   ├── runDaily.ts           # To be replaced by ProcessorOrchestrator
   │   ├── ETLProcessor.ts       # To be split into smaller services
   │   └── nswGovJobs.js        # To be refactored into TypeScript and split
   ├── spiders/                  # Review and clean up
   ├── utils/                    # Review and consolidate
   └── scripts/                  # Review for redundancy
   ```

3. **Files to Review for Removal/Consolidation**
   - Duplicate utility functions across files
   - Old migration scripts
   - Deprecated feature files
   - Test files for removed features
   - Backup or temporary files

### Phase 0.1: Safe Removal Process (Week 1)

1. **Categorize Files**
   - **Category 1**: Definitely unused (safe to remove)
   - **Category 2**: Potentially unused (needs verification)
   - **Category 3**: Used but needs refactoring
   - **Category 4**: Used and current

2. **Verification Process**
   - Create a test branch
   - Remove Category 1 files
   - Run full test suite
   - Monitor in staging environment
   - Document any dependencies discovered

3. **Documentation Requirements**
   - List of files to be removed
   - Reason for removal
   - Potential impact
   - Rollback plan

### Integration with Main Refactoring Plan

The code cleanup will be integrated with the main refactoring phases:

1. **ETLProcessor Migration**
   - Create new service classes
   - Move functionality piece by piece
   - Add tests for each piece
   - Validate each migration step
   - Remove old code once verified

2. **runDaily Migration**
   - Create ProcessorOrchestrator
   - Move environment setup
   - Move job processing logic
   - Add improved error handling
   - Remove old file once verified

## Step-by-Step Refactoring Plan

### Phase 1: Setup and Infrastructure (Week 1)

1. **Project Structure Setup**
   - Create new directory structure
   - Setup TypeScript configuration
   - Configure testing framework (Jest)
   - Setup linting and formatting

2. **Configuration Management**
   - Create configuration modules
   - Move all hardcoded values to config files
   - Implement environment variable handling

### Phase 2: Core Models and Interfaces (Week 1-2)

1. **Define Core Models**
   ```typescript
   // models/job.ts
   interface Job {
     id: string;
     title: string;
     department: string;
     // ... other properties
   }

   // models/role.ts
   interface Role {
     id: string;
     title: string;
     capabilities: Capability[];
     // ... other properties
   }
   ```

2. **Create Service Interfaces**
   ```typescript
   // services/spider/interfaces/IJobSpider.ts
   interface IJobSpider {
     launch(): Promise<Job[]>;
     scrapeJobs(): Promise<Job[]>;
     scrapeJobDetails(jobId: string): Promise<JobDetails>;
   }
   ```

### Phase 3: Spider Service Refactoring (Week 2)

1. **Create Base Spider Class**
   ```typescript
   abstract class BaseSpider {
     protected browser: Browser;
     protected page: Page;
     
     abstract launch(): Promise<void>;
     abstract terminate(): Promise<void>;
   }
   ```

2. **Split NSWJobSpider**
   - Create specialized classes for different scraping tasks
   - Implement proper inheritance
   - Add retry mechanisms and error handling

### Phase 4: Data Processing Services (Week 3)

1. **Create Job Processor Service**
   ```typescript
   class JobProcessor {
     constructor(
       private analyzer: IAnalyzer,
       private storage: IStorageService
     ) {}

     async processJob(job: Job): Promise<ProcessedJob>;
     async extractCapabilities(job: Job): Promise<Capability[]>;
     async extractSkills(job: Job): Promise<Skill[]>;
   }
   ```

2. **Implement AI Analysis Service**
   ```typescript
   class AIAnalyzer implements IAnalyzer {
     constructor(private openai: OpenAIApi) {}
     
     async analyzeJobDescription(content: string): Promise<Analysis>;
     async extractCapabilities(content: string): Promise<Capability[]>;
     async extractSkills(content: string): Promise<Skill[]>;
   }
   ```

### Phase 5: Storage Layer Refactoring (Week 4)

1. **Create Database Service**
   ```typescript
   class DatabaseService implements IStorageService {
     constructor(private supabase: SupabaseClient) {}
     
     async upsertJob(job: Job): Promise<Job>;
     async upsertRole(role: Role): Promise<Role>;
     async linkCapabilities(roleId: string, capabilities: Capability[]): Promise<void>;
   }
   ```

2. **Implement Repository Pattern**
   - Create repositories for each entity type
   - Implement data access methods
   - Add caching layer if needed

### Phase 6: Document Processing (Week 5)

1. **Create Document Service**
   ```typescript
   class DocumentProcessor {
     async processDocument(doc: Document): Promise<ProcessedDocument>;
     async extractText(buffer: Buffer, type: string): Promise<string>;
     async analyzeContent(content: string): Promise<DocumentAnalysis>;
   }
   ```

2. **Implement Document Storage**
   - Handle different document types
   - Implement content extraction
   - Add document analysis capabilities

### Phase 7: Migration and Taxonomy (Week 6)

1. **Create Migration Service**
   ```typescript
   class MigrationService {
     async migrateToLive(data: MigrationData): Promise<MigrationResult>;
     async validateMigration(result: MigrationResult): Promise<void>;
     async rollbackOnFailure(migrationId: string): Promise<void>;
   }
   ```

2. **Implement Taxonomy Processing**
   - Create taxonomy service
   - Implement classification logic
   - Add validation rules

### Phase 8: Testing and Documentation (Week 7)

1. **Unit Tests**
   - Write tests for each service
   - Add integration tests
   - Implement E2E tests

2. **Documentation**
   - Add JSDoc comments
   - Create API documentation
   - Write usage examples

## Implementation Strategy

1. **Incremental Approach**
   - Implement changes one module at a time
   - Maintain backward compatibility
   - Add feature flags for gradual rollout

2. **Testing Strategy**
   - Write tests before refactoring
   - Maintain test coverage
   - Use dependency injection for testability

3. **Deployment Plan**
   - Deploy changes in phases
   - Monitor performance metrics
   - Have rollback plans ready

## Risk Mitigation

1. **Data Integrity**
   - Implement validation at each layer
   - Add data consistency checks
   - Maintain audit logs

2. **Performance**
   - Monitor response times
   - Implement caching where needed
   - Add performance testing

3. **Error Handling**
   - Implement proper error boundaries
   - Add retry mechanisms
   - Improve error reporting

## Success Metrics

1. **Code Quality**
   - Reduced code complexity
   - Improved test coverage
   - Better type safety

2. **Maintainability**
   - Smaller, focused modules
   - Clear separation of concerns
   - Better documentation

3. **Performance**
   - Improved processing speed
   - Reduced error rates
   - Better resource utilization

## Timeline and Resources

- Total Duration: 7-8 weeks
- Team Size: 2-3 developers
- Key Dependencies:
  - TypeScript expertise
  - Testing framework knowledge
  - Database migration experience

## Next Steps

1. Review and approve refactoring plan
2. Set up new project structure
3. Begin Phase 1 implementation
4. Schedule regular progress reviews
5. Plan for gradual feature migration

## Updated Timeline

1. **Week 1**
   - Code audit and cleanup (Phase 0)
   - Project structure setup (Phase 1)

2. **Week 2**
   - Complete safe removal of unused code
   - Core models and interfaces (Phase 2)

## Migration Strategy for ETLProcessor and runDaily

1. **ETLProcessor Migration**
   - Create new service classes
   - Move functionality piece by piece
   - Add tests for each piece
   - Validate each migration step
   - Remove old code once verified

2. **runDaily Migration**
   - Create ProcessorOrchestrator
   - Move environment setup
   - Move job processing logic
   - Add improved error handling
   - Remove old file once verified

## Code Removal Success Metrics

1. **Codebase Metrics**
   - Reduction in total lines of code
   - Reduction in number of files
   - Improvement in code coverage
   - Reduction in cyclomatic complexity

2. **Performance Metrics**
   - Reduced memory usage
   - Improved startup time
   - Reduced build time
   - Smaller bundle size

3. **Maintenance Metrics**
   - Fewer dependencies
   - Clearer file organization
   - Better documentation coverage
   - Reduced technical debt
