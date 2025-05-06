import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

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
  let totalLevels = 0;

  roles.forEach(role => {
    if (role.raw_json?.details?.documents) {
      role.raw_json.details.documents.forEach(doc => {
        // Process focus capabilities
        if (Array.isArray(doc.structuredData?.focusCapabilities)) {
          doc.structuredData.focusCapabilities.forEach((cap, idx) => {
            console.log(`Processing focus capability level ${idx}:`, {
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

            if (capabilityName && level) {
              const capabilityId = capabilityMap.get(capabilityName);
              if (capabilityId) {
                const levelKey = `${capabilityId}-${level}`;
                if (!capabilityLevels.has(levelKey)) {
                  capabilityLevels.set(levelKey, {
                    id: uuidv4(),
                    capability_id: capabilityId,
                    level: level,
                    summary: null,
                    behavioral_indicators: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                  totalLevels++;
                  console.log(`Added focus capability level: ${capabilityName} - ${level}`);
                }
              }
            }
          });
        }

        // Process complementary capabilities
        if (Array.isArray(doc.structuredData?.complementaryCapabilities)) {
          doc.structuredData.complementaryCapabilities.forEach((cap, idx) => {
            console.log(`Processing complementary capability level ${idx}:`, {
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

            if (capabilityName && level) {
              const capabilityId = capabilityMap.get(capabilityName);
              if (capabilityId) {
                const levelKey = `${capabilityId}-${level}`;
                if (!capabilityLevels.has(levelKey)) {
                  capabilityLevels.set(levelKey, {
                    id: uuidv4(),
                    capability_id: capabilityId,
                    level: level,
                    summary: null,
                    behavioral_indicators: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                  totalLevels++;
                  console.log(`Added complementary capability level: ${capabilityName} - ${level}`);
                }
              }
            }
          });
        }
      });
    }
  });

  console.log(`Total unique capability levels extracted: ${totalLevels}`);
  return Array.from(capabilityLevels.values());
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
  
  // Extract from NSW Gov jobs departments
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
  
  // Extract from Seek jobs companies
  seekJobs.jobs.forEach(job => {
    if (job.company && !divisions.has(job.company)) {
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
  });
  
  return divisions;
}

// Extract skills using NLP from role text
function extractSkillsFromText(text) {
  if (!text) return [];
  
  // Basic NLP rules for skill extraction
  const skills = new Set();
  
  // Remove common non-skill phrases
  const cleanText = text.replace(/must have|should have|will have|you will|you should|demonstrated|experience in/gi, '');
  
  // Split into sentences
  const sentences = cleanText.split(/[.;]/);
  
  sentences.forEach(sentence => {
    // Look for technical terms, tools, methodologies
    const words = sentence.trim().split(/\s+/);
    let phrase = '';
    
    words.forEach(word => {
      // Skip common words and keep potential skill terms
      if (word.length > 2 && 
          !word.match(/^(the|and|or|in|on|at|to|for|of|with|by|from|up|about|into|over|after)$/i)) {
        
        if (phrase) phrase += ' ';
        phrase += word;
        
        // Check if we have a valid skill phrase
        if (phrase.length > 3 && phrase.length < 50) {
          skills.add(phrase.trim());
        }
      } else {
        phrase = '';
      }
    });
  });
  
  return Array.from(skills);
}

// Extract skills from role data using NLP
function extractSkills(roles) {
  const skills = new Map();
  
  roles.forEach(role => {
    // Combine all relevant text fields
    const textFields = [
      role.primaryPurpose,
      ...(role.keyAccountabilities || []),
      ...(role.keyChallenges || []),
      ...(role.essentialRequirements || [])
    ].filter(Boolean);
    
    const combinedText = textFields.join('. ');
    const extractedSkills = extractSkillsFromText(combinedText);
    
    extractedSkills.forEach(skillName => {
      if (!skills.has(skillName)) {
        skills.set(skillName, {
          id: uuidv4(),
          name: skillName,
          category: 'Extracted',
          description: `Skill extracted from role: ${role.title}`,
          source: 'nlp_extraction',
          is_occupation_specific: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });
  });
  
  return Array.from(skills.values());
}

// Process role capabilities
function createRoleCapabilities(roles, capabilities) {
  console.log('\nCreating role-capability relationships...');
  const roleCapabilities = [];
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
                roleCapabilities.push({
                  id: uuidv4(),
                  role_id: role.id,
                  capability_id: capabilityId,
                  capability_type: 'focus',
                  level: level,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
                totalRelationships++;
                console.log(`Added focus capability relationship: ${role.title} - ${capabilityName} (${level})`);
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
                roleCapabilities.push({
                  id: uuidv4(),
                  role_id: role.id,
                  capability_id: capabilityId,
                  capability_type: 'complementary',
                  level: level,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
                totalRelationships++;
                console.log(`Added complementary capability relationship: ${role.title} - ${capabilityName} (${level})`);
              }
            }
          });
        }
      });
    }
  });

  console.log(`Total role-capability relationships created: ${totalRelationships}`);
  return roleCapabilities;
}

// Process role skills
function createRoleSkills(roles, skills) {
  const roleSkills = [];
  const skillMap = new Map(skills.map(s => [s.name, s.id]));
  
  roles.forEach(role => {
    // Combine all relevant text fields
    const textFields = [
      role.primaryPurpose,
      ...(role.keyAccountabilities || []),
      ...(role.keyChallenges || []),
      ...(role.essentialRequirements || [])
    ].filter(Boolean);
    
    const combinedText = textFields.join('. ');
    const extractedSkills = extractSkillsFromText(combinedText);
    
    extractedSkills.forEach(skillName => {
      const skillId = skillMap.get(skillName);
      if (skillId) {
        roleSkills.push({
          role_id: role.id,
          skill_id: skillId
        });
      }
    });
  });
  
  return roleSkills;
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
    
    // Process divisions from both sources
    const divisions = extractDivisions(nswgovJobs, seekJobs, companies[0].id);
    
    // Process roles and related data
    const roles = [];
    const jobs = [];
    const jobDocuments = [];
    const roleDocuments = [];
    
    // Process NSW Gov jobs
    nswgovJobs.jobs.forEach(job => {
      const roleId = uuidv4();
      const jobId = uuidv4();
      const divisionId = job.department ? divisions.get(job.department)?.id : null;
      
      // Find matching documents in nswgovDocs
      const jobDocs = nswgovDocs.documents.filter(doc => doc.jobId === job.jobId);
      console.log(`\nProcessing job ${job.jobId}:`, {
        title: job.title,
        documents_found: jobDocs.length,
        document_details: jobDocs.map(doc => ({
          id: doc.id,
          type: doc.type,
          has_structured_data: !!doc.structuredData,
          capability_counts: {
            focus: doc.structuredData?.focusCapabilities?.length || 0,
            complementary: doc.structuredData?.complementaryCapabilities?.length || 0
          }
        }))
      });
      
      // Create role
      const role = {
        id: roleId,
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
      
      roles.push(role);
      
      // Create job
      jobs.push({
        id: jobId,
        role_id: roleId,
        title: job.title,
        open_date: job.postingDate,
        close_date: job.closingDate,
        department: job.department,
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
            role_id: roleId,
            document_id: documentId,
            document_url: doc.sourceDocumentUrl,
            document_type: doc.type,
            title: doc.title
          });
        });
      }
    });
    
    // Process Seek jobs
    seekJobs.jobs.forEach(job => {
      const roleId = uuidv4();
      const jobId = uuidv4();
      const divisionId = job.company ? divisions.get(job.company)?.id : null;
      
      // Create role and job entries similar to NSW Gov processing
      // ... implementation ...
    });
    
    // Extract capabilities, levels, skills and relationships
    const capabilities = extractCapabilities(roles);
    const capabilityLevels = extractCapabilityLevels(roles, capabilities);
    const skills = extractSkills(roles);
    const roleCapabilities = createRoleCapabilities(roles, capabilities);
    const roleSkills = createRoleSkills(roles, skills);
    
    // Write all seed files
    await writeSeedFile(TABLES.companies, companies);
    await writeSeedFile(TABLES.divisions, Array.from(divisions.values()));
    await writeSeedFile(TABLES.roles, roles);
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
    process.exit(1);
  }
}

// Run the processor
processSeedData(); 