import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getEmbeddings, generateEmbeddingText } from '../utils/embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for file paths
const SOURCE_PATHS = {
  nswgovJobs: path.join(__dirname, '..', 'database/jobs/nswgov-2025-05-06.json'),
  seekJobs: path.join(__dirname, '..', 'database/jobs/seek-2025-05-06.json'),
  nswgovDocs: path.join(__dirname, '..', 'database/documents/nswgov-docs-2025-05-06.json'),
  seekDocs: path.join(__dirname, '..', 'database/documents/seek-docs-2025-05-06.json')
};

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

// Helper to ensure directories exist
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Helper to read JSON file
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return null;
  }
}

// Helper to write seed file
async function writeSeedFile(fileName, data) {
  const filePath = path.join(SEED_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Written ${filePath}`);
}

// Extract unique capabilities from role data
function extractCapabilities(roles) {
  console.log('\nExtracting capabilities...');
  console.log(`Total roles to process: ${roles.length}`);

  const capabilities = new Map();
  let totalCapabilities = 0;

  roles.forEach(role => {
    if (role.raw_json?.details?.documents) {
      console.log(`\nProcessing documents for role: ${role.title}`);
      role.raw_json.details.documents.forEach((doc, docIndex) => {
        console.log(`\nDocument ${docIndex + 1} structure:`, JSON.stringify({
          has_structured_data: !!doc.structuredData,
          structured_data_keys: doc.structuredData ? Object.keys(doc.structuredData) : [],
          focus_capabilities_raw: doc.structuredData?.focusCapabilities,
          focus_capabilities_type: doc.structuredData?.focusCapabilities ? typeof doc.structuredData.focusCapabilities : 'undefined',
          focus_capabilities_is_array: Array.isArray(doc.structuredData?.focusCapabilities),
          complementary_capabilities_raw: doc.structuredData?.complementaryCapabilities,
          complementary_capabilities_type: doc.structuredData?.complementaryCapabilities ? typeof doc.structuredData.complementaryCapabilities : 'undefined',
          complementary_capabilities_is_array: Array.isArray(doc.structuredData?.complementaryCapabilities)
        }, null, 2));

        // Process focus capabilities
        if (Array.isArray(doc.structuredData?.focusCapabilities)) {
          doc.structuredData.focusCapabilities.forEach((cap, idx) => {
            console.log(`Focus capability ${idx}:`, {
              value: cap,
              type: typeof cap,
              is_string: typeof cap === 'string',
              has_split: typeof cap === 'string' ? typeof cap.split === 'function' : false,
              raw: JSON.stringify(cap)
            });

            let capabilityName, level;
            if (typeof cap === 'string') {
              [capabilityName, level] = cap.split(' - ').map(s => s.trim());
            } else if (typeof cap === 'object' && cap !== null) {
              // Handle object format if it exists
              capabilityName = cap.capabilityName || cap.name || cap.capability;
              level = cap.level;
            } else {
              console.log('Skipping invalid capability format:', cap);
              return;
            }

            if (capabilityName) {
              console.log('Processing focus capability:', { capabilityName, level });
              
              if (!capabilities.has(capabilityName)) {
                capabilities.set(capabilityName, {
                  id: uuidv4(),
                  name: capabilityName,
                  group_name: null,
                  description: null,
                  source_framework: 'NSW Capability Framework',
                  is_occupation_specific: capabilityName.includes('Legal') || capabilityName.includes('Legislative'),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
                totalCapabilities++;
                console.log(`Added focus capability: ${capabilityName}`);
              }
            }
          });
        }

        // Process complementary capabilities
        if (Array.isArray(doc.structuredData?.complementaryCapabilities)) {
          doc.structuredData.complementaryCapabilities.forEach((cap, idx) => {
            console.log(`Complementary capability ${idx}:`, {
              value: cap,
              type: typeof cap,
              is_string: typeof cap === 'string',
              has_split: typeof cap === 'string' ? typeof cap.split === 'function' : false,
              raw: JSON.stringify(cap)
            });

            let capabilityName, level;
            if (typeof cap === 'string') {
              [capabilityName, level] = cap.split(' - ').map(s => s.trim());
            } else if (typeof cap === 'object' && cap !== null) {
              // Handle object format if it exists
              capabilityName = cap.capabilityName || cap.name || cap.capability;
              level = cap.level;
            } else {
              console.log('Skipping invalid capability format:', cap);
              return;
            }

            if (capabilityName) {
              console.log('Processing complementary capability:', { capabilityName, level });
              
              if (!capabilities.has(capabilityName)) {
                capabilities.set(capabilityName, {
                  id: uuidv4(),
                  name: capabilityName,
                  group_name: null,
                  description: null,
                  source_framework: 'NSW Capability Framework',
                  is_occupation_specific: capabilityName.includes('Legal') || capabilityName.includes('Legislative'),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
                totalCapabilities++;
                console.log(`Added complementary capability: ${capabilityName}`);
              }
            }
          });
        }
      });
    }
  });

  console.log(`\nTotal unique capabilities extracted: ${totalCapabilities}`);
  return Array.from(capabilities.values());
}

// Extract capability levels from role data
function extractCapabilityLevels(roles, capabilities) {
  console.log('\nExtracting capability levels...');
  const capabilityLevels = new Map();
  const capabilityMap = new Map(capabilities.map(c => [c.name, c.id]));
  
  // Debug: Log all capability IDs in a structured way
  console.log('\nAvailable Capabilities:');
  console.log('----------------------');
  capabilities.forEach(c => {
    console.log(`Name: "${c.name}"\nID: ${c.id}\n`);
  });
  
  let totalLevels = 0;

  roles.forEach(role => {
    if (role.raw_json?.details?.documents) {
      role.raw_json.details.documents.forEach(doc => {
        // Process focus capabilities
        if (Array.isArray(doc.structuredData?.focusCapabilities)) {
          doc.structuredData.focusCapabilities.forEach((cap, idx) => {
            let capabilityName, level;
            if (typeof cap === 'string') {
              [capabilityName, level] = cap.split(' - ').map(s => s.trim());
            } else if (typeof cap === 'object' && cap !== null) {
              capabilityName = cap.capabilityName || cap.name || cap.capability;
              level = cap.level;
            } else {
              console.log('Skipping invalid capability format:', cap);
              return;
            }

            if (capabilityName && level) {
              const capabilityId = capabilityMap.get(capabilityName);
              if (capabilityId) {
                const levelKey = `${capabilityId}-${level}`;
                if (!capabilityLevels.has(levelKey)) {
                  const levelData = {
                    id: uuidv4(),
                    capability_id: capabilityId,
                    level: level,
                    summary: null,
                    behavioral_indicators: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  };
                  capabilityLevels.set(levelKey, levelData);
                  totalLevels++;
                  console.log(`\nAdded Capability Level:`);
                  console.log(`Capability: "${capabilityName}"`);
                  console.log(`Level: ${level}`);
                  console.log(`Using Capability ID: ${capabilityId}`);
                }
              } else {
                console.warn(`\n⚠️ WARNING: No capability ID found`);
                console.warn(`Capability Name: "${capabilityName}"`);
                console.warn(`Available names: ${Array.from(capabilityMap.keys()).join(', ')}`);
              }
            }
          });
        }

        // Process complementary capabilities with similar debug output
        if (Array.isArray(doc.structuredData?.complementaryCapabilities)) {
          doc.structuredData.complementaryCapabilities.forEach((cap, idx) => {
            let capabilityName, level;
            if (typeof cap === 'string') {
              [capabilityName, level] = cap.split(' - ').map(s => s.trim());
            } else if (typeof cap === 'object' && cap !== null) {
              capabilityName = cap.capabilityName || cap.name || cap.capability;
              level = cap.level;
            } else {
              console.log('Skipping invalid capability format:', cap);
              return;
            }

            if (capabilityName && level) {
              const capabilityId = capabilityMap.get(capabilityName);
              if (capabilityId) {
                const levelKey = `${capabilityId}-${level}`;
                if (!capabilityLevels.has(levelKey)) {
                  const levelData = {
                    id: uuidv4(),
                    capability_id: capabilityId,
                    level: level,
                    summary: null,
                    behavioral_indicators: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  };
                  capabilityLevels.set(levelKey, levelData);
                  totalLevels++;
                  console.log(`\nAdded Capability Level:`);
                  console.log(`Capability: "${capabilityName}"`);
                  console.log(`Level: ${level}`);
                  console.log(`Using Capability ID: ${capabilityId}`);
                }
              } else {
                console.warn(`\n⚠️ WARNING: No capability ID found`);
                console.warn(`Capability Name: "${capabilityName}"`);
                console.warn(`Available names: ${Array.from(capabilityMap.keys()).join(', ')}`);
              }
            }
          });
        }
      });
    }
  });

  const levels = Array.from(capabilityLevels.values());
  
  // Debug: Show final capability level summary
  console.log('\nCapability Levels Summary:');
  console.log('-------------------------');
  levels.forEach(level => {
    console.log(`\nLevel ID: ${level.id}`);
    console.log(`Capability ID: ${level.capability_id}`);
    console.log(`Level: ${level.level}`);
    // Check if this capability ID exists
    const matchingCap = capabilities.find(c => c.id === level.capability_id);
    if (!matchingCap) {
      console.warn(`⚠️ WARNING: This references a non-existent capability ID!`);
    } else {
      console.log(`Capability Name: ${matchingCap.name}`);
    }
  });

  return levels;
}

// Create companies seed data
const companies = [
  {
    id: uuidv4(),
    name: 'DCCEEW',
    description: 'Department of Climate Change, Energy, the Environment and Water',
    website: 'https://www.dcceew.nsw.gov.au',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Process divisions from both sources
function extractDivisions(nswgovJobs, seekJobs, companyId) {
  const divisions = new Map();
  
  // Extract from NSW Gov jobs departments - keep all of these
  nswgovJobs.jobs.forEach(job => {
    if (job.department && !divisions.has(job.department)) {
      divisions.set(job.department, {
        id: uuidv4(),
        company_id: companyId,
        name: job.department,
        cluster: job.cluster || null,
        agency: job.agency || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  });
  
  // Extract from Seek jobs - only include DCCEEW
  const validEmployers = [
    'department of climate change, energy, the environment & water',
    'department of climate change, energy, the environment and water'
  ];
  
  // Extract from Seek jobs companies
  seekJobs.jobs.forEach(job => {
    if (job.company && !divisions.has(job.company)) {
      const companyLower = job.company.toLowerCase();
      
      // Only include if the company is DCCEEW
      if (validEmployers.includes(companyLower)) {
        divisions.set(job.company, {
          id: uuidv4(),
          company_id: companyId,
          name: job.company,
          cluster: null,
          agency: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  });
  
  return divisions;
}

// Extract skills from role data using AI-extracted skills
function extractSkills(roles) {
  const skills = new Map();
  let totalSkills = 0;
  
  roles.forEach(role => {
    console.log(`\nExtracting skills from role: ${role.title}`);
    
    // Get skills from structured data
    if (role.raw_json?.details?.documents) {
      role.raw_json.details.documents.forEach(doc => {
        if (doc.structuredData?.skills && Array.isArray(doc.structuredData.skills)) {
          console.log(`Processing ${doc.structuredData.skills.length} AI-extracted skills from document`);
          
          doc.structuredData.skills.forEach(skillName => {
            // Clean and normalize the skill name
            skillName = skillName.trim()
              // Remove common non-skill words at the start
              .replace(/^(the|a|an|and|or|to|for|in|on|at|by|of)\s+/, '')
              // Capitalize first letter of each word
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            // Skip if skill name is too short or too long
            if (skillName.length <= 2 || skillName.length >= 50) return;
            // Skip if skill is just numbers or single letters
            if (/^\d+$/.test(skillName) || /^[A-Za-z]$/.test(skillName)) return;

            if (!skills.has(skillName)) {
              skills.set(skillName, {
                id: uuidv4(),
                name: skillName,
                category: 'AI Extracted',
                description: `Skill extracted by AI from role: ${role.title}`,
                source: 'ai_extraction',
                is_occupation_specific: 
                  skillName.toLowerCase().includes('legal') || 
                  skillName.toLowerCase().includes('regulatory') ||
                  skillName.toLowerCase().includes('compliance') ||
                  skillName.toLowerCase().includes('policy'),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              totalSkills++;
              console.log(`Added skill: ${skillName}`);
            }
          });
        }
      });
    }
  });
  
  console.log(`\nTotal unique skills extracted: ${totalSkills}`);
  return Array.from(skills.values());
}

// Process role capabilities
function createRoleCapabilities(roles, capabilities) {
  console.log('\nCreating role-capability relationships...');
  const roleCapabilitiesMap = new Map(); // Map to store unique role-capability combinations
  const capabilityMap = new Map(capabilities.map(c => [c.name, c.id]));
  let totalRelationships = 0;

  roles.forEach(role => {
    if (role.raw_json?.details?.documents) {
      role.raw_json.details.documents.forEach(doc => {
        // Process focus capabilities
        if (Array.isArray(doc.structuredData?.focusCapabilities)) {
          doc.structuredData.focusCapabilities.forEach((cap, idx) => {
            console.log(`Processing focus capability relationship ${idx}:`, {
              value: cap,
              type: typeof cap,
              is_string: typeof cap === 'string',
              raw: JSON.stringify(cap)
            });

            let capabilityName, level;
            if (typeof cap === 'string') {
              [capabilityName, level] = cap.split(' - ').map(s => s.trim());
            } else if (typeof cap === 'object' && cap !== null) {
              // Handle object format if it exists
              capabilityName = cap.capabilityName || cap.name || cap.capability;
              level = cap.level;
            } else {
              console.log('Skipping invalid capability format:', cap);
              return;
            }

            if (capabilityName) {
              const capabilityId = capabilityMap.get(capabilityName);
              if (capabilityId) {
                // Create a unique key for this role-capability combination
                const key = `${role.id}|${capabilityId}|focus`;
                if (!roleCapabilitiesMap.has(key)) {
                  roleCapabilitiesMap.set(key, {
                    role_id: role.id,
                    capability_id: capabilityId,
                    capability_type: 'focus',
                    level: level
                  });
                  totalRelationships++;
                  console.log(`Added focus capability relationship: ${role.title} - ${capabilityName} (${level})`);
                }
              }
            }
          });
        }

        // Process complementary capabilities
        if (Array.isArray(doc.structuredData?.complementaryCapabilities)) {
          doc.structuredData.complementaryCapabilities.forEach((cap, idx) => {
            console.log(`Processing complementary capability relationship ${idx}:`, {
              value: cap,
              type: typeof cap,
              is_string: typeof cap === 'string',
              raw: JSON.stringify(cap)
            });

            let capabilityName, level;
            if (typeof cap === 'string') {
              [capabilityName, level] = cap.split(' - ').map(s => s.trim());
            } else if (typeof cap === 'object' && cap !== null) {
              // Handle object format if it exists
              capabilityName = cap.capabilityName || cap.name || cap.capability;
              level = cap.level;
            } else {
              console.log('Skipping invalid capability format:', cap);
              return;
            }

            if (capabilityName) {
              const capabilityId = capabilityMap.get(capabilityName);
              if (capabilityId) {
                // Create a unique key for this role-capability combination
                const key = `${role.id}|${capabilityId}|complementary`;
                if (!roleCapabilitiesMap.has(key)) {
                  roleCapabilitiesMap.set(key, {
                    role_id: role.id,
                    capability_id: capabilityId,
                    capability_type: 'complementary',
                    level: level
                  });
                  totalRelationships++;
                  console.log(`Added complementary capability relationship: ${role.title} - ${capabilityName} (${level})`);
                }
              }
            }
          });
        }
      });
    }
  });

  console.log(`Total unique role-capability relationships created: ${totalRelationships}`);
  return Array.from(roleCapabilitiesMap.values());
}

// Process role skills
function createRoleSkills(roles, skills) {
  console.log('\nCreating role-skill relationships...');
  const roleSkillsMap = new Map(); // Map to store unique role-skill combinations
  const skillMap = new Map(skills.map(s => [s.name, s.id]));
  let totalRelationships = 0;
  
  roles.forEach(role => {
    console.log(`\nProcessing skills for role: ${role.title}`);
    
    if (role.raw_json?.details?.documents) {
      role.raw_json.details.documents.forEach(doc => {
        if (doc.structuredData?.skills && Array.isArray(doc.structuredData.skills)) {
          doc.structuredData.skills.forEach(skillName => {
            // Clean and normalize the skill name (same as in extractSkills)
            skillName = skillName.trim()
              .replace(/^(the|a|an|and|or|to|for|in|on|at|by|of)\s+/, '')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            const skillId = skillMap.get(skillName);
            if (skillId) {
              // Create a unique key for this role-skill combination
              const key = `${role.id}|${skillId}`;
              if (!roleSkillsMap.has(key)) {
                roleSkillsMap.set(key, {
                  role_id: role.id,
                  skill_id: skillId
                });
                totalRelationships++;
                console.log(`Added role-skill relationship: ${role.title} - ${skillName}`);
              }
            }
          });
        }
      });
    }
  });
  
  console.log(`\nTotal unique role-skill relationships created: ${totalRelationships}`);
  return Array.from(roleSkillsMap.values());
}

// Main processing function
async function processSeedData() {
  try {
    // Ensure seed directory exists
    await ensureDir(SEED_DIR);
    
    // Read source files
    const nswgovJobs = await readJsonFile(SOURCE_PATHS.nswgovJobs);
    const seekJobs = await readJsonFile(SOURCE_PATHS.seekJobs);
    const nswgovDocs = await readJsonFile(SOURCE_PATHS.nswgovDocs);
    const seekDocs = await readJsonFile(SOURCE_PATHS.seekDocs);
    
    if (!nswgovJobs || !seekJobs || !nswgovDocs || !seekDocs) {
      throw new Error('Failed to read source files');
    }
    
    // Generate embeddings for companies
    console.log('\nGenerating embeddings for companies...');
    for (const company of companies) {
      try {
        const companyText = generateEmbeddingText({
          name: company.name,
          description: company.description,
          type: company.type,
          sector: company.sector
        });
        company.embedding = await getEmbeddings(companyText);
        console.log(`Generated embedding for company: ${company.name}`);
      } catch (error) {
        console.error(`Failed to generate embedding for company ${company.name}:`, error);
        company.embedding = null;
      }
    }
    
    // Process divisions and generate their embeddings
    const divisions = extractDivisions(nswgovJobs, seekJobs, companies[0].id);
    console.log('\nGenerating embeddings for divisions...');
    for (const division of divisions.values()) {
      try {
        const divisionText = generateEmbeddingText({
          name: division.name,
          cluster: division.cluster,
          agency: division.agency
        });
        division.embedding = await getEmbeddings(divisionText);
        console.log(`Generated embedding for division: ${division.name}`);
      } catch (error) {
        console.error(`Failed to generate embedding for division ${division.name}:`, error);
        division.embedding = null;
      }
    }
    
    // Process roles and related data
    const roles = new Map(); // Map to store unique roles by key
    const jobs = [];
    const jobDocuments = [];
    const roleDocuments = [];
    
    // Helper to generate a unique role key
    function generateRoleKey(job) {
      // Combine relevant fields to create a unique key
      const keyParts = [
        job.title,
        job.department || job.company || '',
        job.gradeBand || '',
        job.anzscoCode || '',
        job.pcatCode || ''
      ];
      return keyParts.join('|').toLowerCase();
    }

    // Process NSW Gov jobs
    console.log('\nProcessing NSW Gov jobs and generating embeddings...');
    for (const job of nswgovJobs.jobs) {
      const jobId = uuidv4();
      const divisionId = job.department ? divisions.get(job.department)?.id : null;
      
      // Find matching documents in nswgovDocs
      const jobDocs = nswgovDocs.documents.filter(doc => doc.jobId === job.jobId);
      
      // Get or create role
      const roleKey = generateRoleKey(job);
      let role;
      
      if (!roles.has(roleKey)) {
        // Create new role
        role = {
          id: uuidv4(),
          title: job.title,
          division_id: divisionId,
          grade_band: job.gradeBand,
          location: Array.isArray(job.locations) ? job.locations[0] : job.locations,
          anzsco_code: job.anzscoCode,
          pcat_code: job.pcatCode,
          date_approved: job.dateApproved,
          primary_purpose: job.primaryPurpose,
          reporting_line: job.reportingLine,
          direct_reports: job.directReports,
          budget_responsibility: job.budgetResponsibility,
          source_document_url: job.sourceDocumentUrl,
          raw_json: {
            details: {
              documents: jobDocs
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Generate and add embedding for role
        try {
          const roleText = generateEmbeddingText(role, 'role');
          role.embedding = await getEmbeddings(roleText);
          console.log(`Generated embedding for role: ${role.title}`);
        } catch (error) {
          console.error(`Failed to generate embedding for role ${role.title}:`, error);
          role.embedding = null;
        }

        roles.set(roleKey, role);
      } else {
        role = roles.get(roleKey);
        // Merge documents if they don't exist
        const existingDocIds = new Set(role.raw_json.details.documents.map(d => d.id));
        jobDocs.forEach(doc => {
          if (!existingDocIds.has(doc.id)) {
            role.raw_json.details.documents.push(doc);
          }
        });
      }
      
      // Create job with embedding
      const jobData = {
        id: jobId,
        role_id: role.id,
        title: job.title,
        open_date: job.postingDate,
        close_date: job.closingDate,
        department: job.department,
        department_id: divisionId,
        job_type: job.jobType,
        external_id: job.jobId,
        source_url: job.jobUrl,
        remuneration: job.remuneration,
        recruiter: job.contactInfo ? { contact: job.contactInfo } : null,
        locations: Array.isArray(job.locations) ? job.locations : [job.locations],
        raw_json: job,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Generate and add embedding for job
      try {
        const jobText = generateEmbeddingText(jobData, 'job');
        jobData.embedding = await getEmbeddings(jobText);
        console.log(`Generated embedding for job: ${jobData.title}`);
      } catch (error) {
        console.error(`Failed to generate embedding for job ${jobData.title}:`, error);
        jobData.embedding = null;
      }

      jobs.push(jobData);
      
      // Process documents
      if (jobDocs.length > 0) {
        jobDocs.forEach(doc => {
          const documentId = uuidv4();
          jobDocuments.push({
            job_id: jobId,
            document_id: documentId,
            document_url: doc.sourceDocumentUrl,
            document_type: doc.type,
            title: doc.title
          });
          
          roleDocuments.push({
            role_id: role.id,
            document_id: documentId,
            document_url: doc.sourceDocumentUrl,
            document_type: doc.type,
            title: doc.title
          });
        });
      }
    }
    
    // Process Seek jobs
    seekJobs.jobs.forEach(job => {
      const jobId = uuidv4();
      const divisionId = job.company ? divisions.get(job.company)?.id : null;
      
      // Skip non-DCCEEW jobs
      const validEmployers = [
        'department of climate change, energy, the environment & water',
        'department of climate change, energy, the environment and water'
      ];
      if (!job.company || !validEmployers.includes(job.company.toLowerCase())) {
        return;
      }
      
      // Find matching documents in seekDocs
      const jobDocs = seekDocs.documents.filter(doc => doc.jobId === job.jobId);
      console.log(`\nProcessing Seek job ${job.jobId}:`, {
        title: job.title,
        company: job.company,
        documents_found: jobDocs.length
      });
      
      // Get or create role
      const roleKey = generateRoleKey(job);
      let role;
      
      if (!roles.has(roleKey)) {
        // Create new role if it doesn't exist
        role = {
          id: uuidv4(),
          title: job.title,
          division_id: divisionId,
          grade_band: job.gradeBand,
          location: Array.isArray(job.locations) ? job.locations[0] : job.locations,
          anzsco_code: job.anzscoCode,
          pcat_code: job.pcatCode,
          date_approved: job.dateApproved,
          primary_purpose: job.primaryPurpose,
          reporting_line: job.reportingLine,
          direct_reports: job.directReports,
          budget_responsibility: job.budgetResponsibility,
          source_document_url: job.sourceDocumentUrl,
          raw_json: {
            details: {
              documents: jobDocs
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        roles.set(roleKey, role);
      } else {
        role = roles.get(roleKey);
        // Merge documents if they don't exist
        const existingDocIds = new Set(role.raw_json.details.documents.map(d => d.id));
        jobDocs.forEach(doc => {
          if (!existingDocIds.has(doc.id)) {
            role.raw_json.details.documents.push(doc);
          }
        });
      }
      
      // Create job
      jobs.push({
        id: jobId,
        role_id: role.id,
        title: job.title,
        open_date: job.postingDate,
        close_date: job.closingDate,
        department: job.company,
        department_id: divisionId,
        job_type: job.jobType,
        external_id: job.jobId,
        source_url: job.jobUrl,
        remuneration: job.remuneration,
        recruiter: job.contactInfo ? { contact: job.contactInfo } : null,
        locations: Array.isArray(job.locations) ? job.locations : [job.locations],
        raw_json: job,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Process documents
      if (jobDocs.length > 0) {
        jobDocs.forEach(doc => {
          const documentId = uuidv4();
          jobDocuments.push({
            job_id: jobId,
            document_id: documentId,
            document_url: doc.sourceDocumentUrl,
            document_type: doc.type,
            title: doc.title
          });
          
          roleDocuments.push({
            role_id: role.id,
            document_id: documentId,
            document_url: doc.sourceDocumentUrl,
            document_type: doc.type,
            title: doc.title
          });
        });
      }
    });
    
    // Convert roles Map to array for further processing
    const rolesArray = Array.from(roles.values());

    // Extract capabilities and relationships
    const capabilities = extractCapabilities(rolesArray);
    
    // Debug: Log capabilities before levels
    console.log('\nCapabilities before extracting levels:');
    capabilities.forEach(c => {
      console.log(`${c.name}: ${c.id}`);
    });
    
    const capabilityLevels = extractCapabilityLevels(rolesArray, capabilities);
    
    // Debug: Verify capability IDs exist
    console.log('\nVerifying capability IDs...');
    const capabilityIds = new Set(capabilities.map(c => c.id));
    const invalidLevels = capabilityLevels.filter(level => !capabilityIds.has(level.capability_id));
    if (invalidLevels.length > 0) {
      console.error('Found invalid capability references:', invalidLevels);
    }
    
    const skills = extractSkills(rolesArray);
    const roleCapabilities = createRoleCapabilities(rolesArray, capabilities);
    const roleSkills = createRoleSkills(rolesArray, skills);
    
    // Generate embeddings for capabilities
    console.log('\nGenerating embeddings for capabilities...');
    for (const capability of capabilities) {
      try {
        const capabilityText = `${capability.name} ${capability.description || ''} ${capability.group_name || ''}`;
        capability.embedding = await getEmbeddings(capabilityText);
        console.log(`Generated embedding for capability: ${capability.name}`);
      } catch (error) {
        console.error(`Failed to generate embedding for capability ${capability.name}:`, error);
        capability.embedding = null;
      }
    }

    // Generate embeddings for skills
    console.log('\nGenerating embeddings for skills...');
    for (const skill of skills) {
      try {
        const skillText = generateEmbeddingText(skill, 'skill');
        skill.embedding = await getEmbeddings(skillText);
        console.log(`Generated embedding for skill: ${skill.name}`);
      } catch (error) {
        console.error(`Failed to generate embedding for skill ${skill.name}:`, error);
        skill.embedding = null;
      }
    }
    
    // Write all seed files
    await writeSeedFile(TABLES.companies, companies);
    await writeSeedFile(TABLES.divisions, Array.from(divisions.values()));
    await writeSeedFile(TABLES.roles, rolesArray);
    await writeSeedFile(TABLES.jobs, jobs);
    await writeSeedFile(TABLES.capabilities, capabilities);
    await writeSeedFile(TABLES.capabilityLevels, capabilityLevels);
    await writeSeedFile(TABLES.skills, skills);
    await writeSeedFile(TABLES.roleCapabilities, roleCapabilities);
    await writeSeedFile(TABLES.roleSkills, roleSkills);
    await writeSeedFile(TABLES.jobDocuments, jobDocuments);
    await writeSeedFile(TABLES.roleDocuments, roleDocuments);
    
    console.log('Seed data preparation completed successfully!');
    
  } catch (error) {
    console.error('Error processing seed data:', error);
    throw error;
  }
}

// Run the processor
processSeedData(); 