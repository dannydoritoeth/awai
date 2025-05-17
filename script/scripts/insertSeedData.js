import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from scrape directory
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Constants for file paths
const SEED_DIR = path.join(__dirname, '..', 'database/seed');
const TABLES = {
  companies: 'companies.json',
  divisions: 'divisions.json',
  roles: 'roles.json',
  jobs: 'jobs.json',
  capabilities: 'capabilities.json',
  capabilityLevels: 'capability_levels.json',
  skills: 'skills.json',
  roleCapabilities: 'role_capabilities.json',
  roleSkills: 'role_skills.json',
  jobDocuments: 'job_documents.json',
  roleDocuments: 'role_documents.json',
  taxonomy: 'taxonomy.json',
  roleTaxonomies: 'role_taxonomies.json'
};

// Helper to read JSON file
async function readSeedFile(fileName) {
  try {
    const filePath = path.join(SEED_DIR, fileName);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${fileName}:`, err);
    return null;
  }
}

// Helper to insert data with duplicate handling
async function insertWithDuplicateHandling(tableName, data) {
  try {
    // Define table configurations for upsert
    const tableConfigs = {
      'companies': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'divisions': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'roles': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'jobs': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'capabilities': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'capability_levels': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'skills': { 
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'role_capabilities': { 
        onConflict: 'role_id,capability_id,capability_type',
        hasTimestamps: false,
        hasId: false,
        fields: ['role_id', 'capability_id', 'capability_type', 'level']
      },
      'role_skills': { 
        onConflict: 'role_id,skill_id',
        hasTimestamps: false,
        hasId: false,
        fields: ['role_id', 'skill_id']
      },
      'job_skills': { 
        onConflict: 'job_id,skill_id',
        hasTimestamps: false,
        hasId: false,
        fields: ['job_id', 'skill_id']
      },
      'job_documents': { 
        onConflict: 'job_id,document_id',
        hasTimestamps: false,
        hasId: false,
        fields: ['job_id', 'document_id', 'document_url', 'document_type', 'title']
      },
      'role_documents': { 
        onConflict: 'role_id,document_id',
        hasTimestamps: false,
        hasId: false,
        fields: ['role_id', 'document_id', 'document_url', 'document_type', 'title']
      },
      'profile_skills': { 
        onConflict: 'profile_id,skill_id',
        hasTimestamps: true,
        hasId: false,
        fields: ['profile_id', 'skill_id', 'rating', 'evidence', 'updated_at']
      },
      'profile_capabilities': { 
        onConflict: 'profile_id,capability_id',
        hasTimestamps: true,
        hasId: false,
        fields: ['profile_id', 'capability_id', 'level', 'updated_at']
      },
      'profile_career_paths': { 
        onConflict: 'profile_id,career_path_id',
        hasTimestamps: false,
        hasId: false,
        fields: ['profile_id', 'career_path_id']
      },
      'profile_job_interactions': { 
        onConflict: 'profile_id,job_id,interaction_type',
        hasTimestamps: true,
        hasId: false,
        fields: ['profile_id', 'job_id', 'interaction_type', 'timestamp']
      },
      'profile_agent_actions': { 
        onConflict: 'profile_id,action_id',
        hasTimestamps: false,
        hasId: false,
        fields: ['profile_id', 'action_id']
      },
      'taxonomy': {
        onConflict: 'id',
        hasTimestamps: true,
        hasId: true
      },
      'role_taxonomies': {
        onConflict: 'role_id,taxonomy_id',
        hasTimestamps: true,
        hasId: false,
        fields: ['role_id', 'taxonomy_id']
      }
    };

    const config = tableConfigs[tableName];
    if (!config) {
      throw new Error(`No upsert configuration found for table: ${tableName}`);
    }

    // Clean the data based on table configuration
    if (!config.hasId || config.fields) {
      data = data.map(record => {
        const cleaned = {};
        const allowedFields = config.fields || config.onConflict.split(',');
        Object.keys(record).forEach(field => {
          if (allowedFields.includes(field)) {
            cleaned[field] = record[field];
          }
        });
        return cleaned;
      });
    }

    const { error } = await supabase
      .from(tableName)
      .upsert(data, {
        onConflict: config.onConflict,
        ignoreDuplicates: false // Set to false to update existing records
      });

    if (error) throw error;

    return {
      inserted: data.length,
      total: data.length,
      skipped: 0
    };
  } catch (error) {
    console.error(`Error upserting into ${tableName}:`, error);
    throw error;
  }
}

// Main function to insert seed data
async function insertSeedData() {
  try {
    console.log('Starting seed data insertion...');

    // 1. Insert companies first (no dependencies)
    const companies = await readSeedFile(TABLES.companies);
    if (companies) {
      const result = await insertWithDuplicateHandling('companies', companies);
      console.log(`Companies: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 2. Insert divisions (depends on companies)
    const divisions = await readSeedFile(TABLES.divisions);
    if (divisions) {
      const result = await insertWithDuplicateHandling('divisions', divisions);
      console.log(`Divisions: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 3. Insert roles (depends on divisions)
    const roles = await readSeedFile(TABLES.roles);
    if (roles) {
      const result = await insertWithDuplicateHandling('roles', roles);
      console.log(`Roles: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 4. Insert capabilities (no dependencies)
    const capabilities = await readSeedFile(TABLES.capabilities);
    if (capabilities) {
      const result = await insertWithDuplicateHandling('capabilities', capabilities);
      console.log(`Capabilities: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 5. Insert capability levels (depends on capabilities)
    const capabilityLevels = await readSeedFile(TABLES.capabilityLevels);
    if (capabilityLevels) {
      const result = await insertWithDuplicateHandling('capability_levels', capabilityLevels);
      console.log(`Capability Levels: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 6. Insert skills (no dependencies)
    const skills = await readSeedFile(TABLES.skills);
    if (skills) {
      const result = await insertWithDuplicateHandling('skills', skills);
      console.log(`Skills: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 7. Insert role capabilities (depends on roles and capabilities)
    const roleCapabilities = await readSeedFile(TABLES.roleCapabilities);
    if (roleCapabilities) {
      const result = await insertWithDuplicateHandling('role_capabilities', roleCapabilities);
      console.log(`Role Capabilities: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 8. Insert role skills (depends on roles and skills)
    const roleSkills = await readSeedFile(TABLES.roleSkills);
    if (roleSkills) {
      const result = await insertWithDuplicateHandling('role_skills', roleSkills);
      console.log(`Role Skills: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 9. Insert jobs (depends on roles)
    const jobs = await readSeedFile(TABLES.jobs);
    if (jobs) {
      const result = await insertWithDuplicateHandling('jobs', jobs);
      console.log(`Jobs: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 10. Insert job documents (depends on jobs)
    const jobDocuments = await readSeedFile(TABLES.jobDocuments);
    if (jobDocuments) {
      const result = await insertWithDuplicateHandling('job_documents', jobDocuments);
      console.log(`Job Documents: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 11. Insert role documents (depends on roles)
    const roleDocuments = await readSeedFile(TABLES.roleDocuments);
    if (roleDocuments) {
      const result = await insertWithDuplicateHandling('role_documents', roleDocuments);
      console.log(`Role Documents: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 12. Insert taxonomies
    const taxonomies = await readSeedFile(TABLES.taxonomy);
    if (taxonomies) {
      const result = await insertWithDuplicateHandling('taxonomy', taxonomies);
      console.log(`Taxonomies: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // 13. Insert role taxonomy links
    const roleTaxonomies = await readSeedFile(TABLES.roleTaxonomies);
    if (roleTaxonomies) {
      const result = await insertWithDuplicateHandling('role_taxonomies', roleTaxonomies);
      console.log(`Role Taxonomies: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    console.log('Seed data insertion completed successfully!');
  } catch (error) {
    console.error('Error during seed data insertion:', error);
    process.exit(1);
  }
}

// Run the insertion process
insertSeedData(); 