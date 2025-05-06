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
  roleDocuments: 'role_documents.json'
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
    // Define junction table configurations
    const junctionTables = {
      'role_capabilities': {
        fields: ['role_id', 'capability_id', 'capability_type', 'level'],
        onConflict: 'role_id,capability_id,capability_type'
      },
      'role_skills': {
        fields: ['role_id', 'skill_id'],
        onConflict: 'role_id,skill_id'
      },
      'job_documents': {
        fields: ['job_id', 'document_id', 'document_url', 'document_type', 'title'],
        onConflict: 'job_id,document_id'
      },
      'role_documents': {
        fields: ['role_id', 'document_id', 'document_url', 'document_type', 'title'],
        onConflict: 'role_id,document_id'
      },
      'profile_skills': {
        fields: ['profile_id', 'skill_id', 'rating', 'evidence', 'updated_at'],
        onConflict: 'profile_id,skill_id'
      },
      'profile_capabilities': {
        fields: ['profile_id', 'capability_id', 'level', 'updated_at'],
        onConflict: 'profile_id,capability_id'
      },
      'profile_career_paths': {
        fields: ['profile_id', 'career_path_id'],
        onConflict: 'profile_id,career_path_id'
      },
      'profile_job_interactions': {
        fields: ['profile_id', 'job_id', 'interaction_type', 'timestamp'],
        onConflict: 'profile_id,job_id,interaction_type'
      },
      'profile_agent_actions': {
        fields: ['profile_id', 'action_id'],
        onConflict: 'profile_id,action_id'
      }
    };

    // Check if this is a junction table
    const junctionConfig = junctionTables[tableName];
    if (junctionConfig) {
      // Keep only the fields defined in the schema
      const cleanedData = data.map(record => {
        const cleaned = {};
        junctionConfig.fields.forEach(field => {
          if (record[field] !== undefined) {
            cleaned[field] = record[field];
          }
        });
        return cleaned;
      });

      const { error } = await supabase
        .from(tableName)
        .upsert(cleanedData, {
          onConflict: junctionConfig.onConflict,
          ignoreDuplicates: true
        });

      if (error) throw error;

      return {
        inserted: cleanedData.length,
        total: data.length,
        skipped: 0
      };
    }

    // Regular handling for tables with id primary key
    const { data: existingRecords, error: queryError } = await supabase
      .from(tableName)
      .select('id')
      .in('id', data.map(item => item.id));

    if (queryError) throw queryError;

    const existingIds = new Set(existingRecords.map(record => record.id));
    const newRecords = data.filter(item => !existingIds.has(item.id));

    if (newRecords.length === 0) {
      console.log(`No new records to insert for ${tableName}`);
      return { inserted: 0, total: data.length };
    }

    const { error: insertError } = await supabase
      .from(tableName)
      .insert(newRecords);

    if (insertError) throw insertError;

    return {
      inserted: newRecords.length,
      total: data.length,
      skipped: data.length - newRecords.length
    };
  } catch (error) {
    console.error(`Error inserting into ${tableName}:`, error);
    throw error;
  }
}

// Main function to insert seed data
async function insertSeedData() {
  try {
    console.log('Starting seed data insertion...');

    // Insert companies first (no dependencies)
    const companies = await readSeedFile(TABLES.companies);
    if (companies) {
      const result = await insertWithDuplicateHandling('companies', companies);
      console.log(`Companies: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert divisions (depends on companies)
    const divisions = await readSeedFile(TABLES.divisions);
    if (divisions) {
      const result = await insertWithDuplicateHandling('divisions', divisions);
      console.log(`Divisions: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert capabilities (no dependencies)
    const capabilities = await readSeedFile(TABLES.capabilities);
    if (capabilities) {
      const result = await insertWithDuplicateHandling('capabilities', capabilities);
      console.log(`Capabilities: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert capability levels (depends on capabilities)
    const capabilityLevels = await readSeedFile(TABLES.capabilityLevels);
    if (capabilityLevels) {
      const result = await insertWithDuplicateHandling('capability_levels', capabilityLevels);
      console.log(`Capability Levels: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert skills (no dependencies)
    const skills = await readSeedFile(TABLES.skills);
    if (skills) {
      const result = await insertWithDuplicateHandling('skills', skills);
      console.log(`Skills: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert roles (depends on divisions)
    const roles = await readSeedFile(TABLES.roles);
    if (roles) {
      const result = await insertWithDuplicateHandling('roles', roles);
      console.log(`Roles: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert jobs (depends on roles)
    const jobs = await readSeedFile(TABLES.jobs);
    if (jobs) {
      const result = await insertWithDuplicateHandling('jobs', jobs);
      console.log(`Jobs: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert role capabilities (depends on roles and capabilities)
    const roleCapabilities = await readSeedFile(TABLES.roleCapabilities);
    if (roleCapabilities) {
      const result = await insertWithDuplicateHandling('role_capabilities', roleCapabilities);
      console.log(`Role Capabilities: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert role skills (depends on roles and skills)
    const roleSkills = await readSeedFile(TABLES.roleSkills);
    if (roleSkills) {
      const result = await insertWithDuplicateHandling('role_skills', roleSkills);
      console.log(`Role Skills: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert job documents (depends on jobs)
    const jobDocuments = await readSeedFile(TABLES.jobDocuments);
    if (jobDocuments) {
      const result = await insertWithDuplicateHandling('job_documents', jobDocuments);
      console.log(`Job Documents: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    // Insert role documents (depends on roles)
    const roleDocuments = await readSeedFile(TABLES.roleDocuments);
    if (roleDocuments) {
      const result = await insertWithDuplicateHandling('role_documents', roleDocuments);
      console.log(`Role Documents: ${result.inserted} inserted, ${result.skipped} skipped`);
    }

    console.log('Seed data insertion completed successfully!');
  } catch (error) {
    console.error('Error inserting seed data:', error);
    process.exit(1);
  }
}

// Run the insertion process
insertSeedData(); 