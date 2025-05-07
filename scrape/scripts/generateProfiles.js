import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchRolesWithCapabilitiesAndSkills() {
  // Fetch roles with their capabilities and skills
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select(`
      id,
      title,
      role_capabilities (
        capability_id,
        capability_type,
        level
      ),
      role_skills (
        skill_id
      )
    `);

  if (rolesError) {
    throw new Error(`Error fetching roles: ${rolesError.message}`);
  }

  // Fetch capabilities and skills to get their names
  const { data: capabilities, error: capsError } = await supabase
    .from('capabilities')
    .select('id, name');

  if (capsError) {
    throw new Error(`Error fetching capabilities: ${capsError.message}`);
  }

  const { data: skills, error: skillsError } = await supabase
    .from('skills')
    .select('id, name');

  if (skillsError) {
    throw new Error(`Error fetching skills: ${skillsError.message}`);
  }

  // Create lookup maps
  const capabilityMap = new Map(capabilities.map(c => [c.id, c]));
  const skillMap = new Map(skills.map(s => [s.id, s]));

  // Enrich roles with capability and skill names
  return roles.map(role => ({
    ...role,
    capabilities: role.role_capabilities.map(rc => ({
      ...rc,
      name: capabilityMap.get(rc.capability_id)?.name
    })),
    skills: role.role_skills.map(rs => ({
      ...rs,
      name: skillMap.get(rs.skill_id)?.name
    }))
  }));
}

async function generateProfiles(count) {
  console.log(`\nGenerating ${count} profiles...`);
  
  // Fetch roles with their capabilities and skills
  const roles = await fetchRolesWithCapabilitiesAndSkills();
  
  // Group roles by similar capabilities to create career paths
  const careerPaths = roles.reduce((paths, role) => {
    const pathKey = role.capabilities
      .filter(c => c.capability_type === 'focus')
      .map(c => c.capability_id)
      .sort()
      .join(',');
    
    if (!paths[pathKey]) {
      paths[pathKey] = [];
    }
    paths[pathKey].push(role);
    return paths;
  }, {});

  const profiles = [];
  const profileCapabilities = [];
  const profileSkills = [];

  // Generate profiles
  for (let i = 0; i < count; i++) {
    // Select a random career path
    const careerPathKeys = Object.keys(careerPaths);
    const selectedPathKey = careerPathKeys[Math.floor(Math.random() * careerPathKeys.length)];
    const relatedRoles = careerPaths[selectedPathKey];
    
    if (!relatedRoles || relatedRoles.length === 0) continue;

    const yearsOfExperience = Math.floor(Math.random() * 15) + 2; // 2-17 years
    const profileId = uuidv4();

    // Create profile
    const profile = {
      id: profileId,
      name: `Test Profile ${i + 1}`,
      email: `testprofile${i + 1}@example.com`,
      role_title: relatedRoles[0]?.title || 'Professional',
      division: null, // Can be updated if needed
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    profiles.push(profile);

    // Assign capabilities from related roles
    const assignedCapabilities = new Set();
    relatedRoles.forEach(role => {
      role.capabilities.forEach(cap => {
        if (!assignedCapabilities.has(cap.capability_id)) {
          assignedCapabilities.add(cap.capability_id);
          profileCapabilities.push({
            profile_id: profileId,
            capability_id: cap.capability_id,
            level: cap.level || 'Intermediate',
            updated_at: new Date().toISOString()
          });
        }
      });
    });

    // Assign skills from related roles
    const assignedSkills = new Set();
    relatedRoles.forEach(role => {
      role.skills.forEach(skill => {
        if (!assignedSkills.has(skill.skill_id)) {
          assignedSkills.add(skill.skill_id);
          profileSkills.push({
            profile_id: profileId,
            skill_id: skill.skill_id,
            rating: ['Beginner', 'Intermediate', 'Advanced', 'Expert'][Math.floor(Math.random() * 4)],
            evidence: `${Math.floor(Math.random() * 10) + 1} years of experience`,
            updated_at: new Date().toISOString()
          });
        }
      });
    });
  }

  return { profiles, profileCapabilities, profileSkills };
}

async function insertProfiles(data) {
  const { profiles, profileCapabilities, profileSkills } = data;

  console.log('\nAttempting to insert profiles:');
  console.log(`- ${profiles.length} profiles`);
  console.log(`- ${profileCapabilities.length} profile capabilities`);
  console.log(`- ${profileSkills.length} profile skills`);

  // Debug log the first profile
  if (profiles.length > 0) {
    console.log('\nSample profile data:', JSON.stringify(profiles[0], null, 2));
  }

  // Insert profiles
  const { data: insertedProfiles, error: profilesError } = await supabase
    .from('profiles')
    .upsert(profiles)
    .select();

  if (profilesError) {
    console.error('\nDetailed profiles error:', profilesError);
    throw new Error(`Error inserting profiles: ${profilesError.message}`);
  }

  console.log('\nSuccessfully inserted profiles');

  // Insert profile capabilities
  const { data: insertedCapabilities, error: capsError } = await supabase
    .from('profile_capabilities')
    .upsert(profileCapabilities)
    .select();

  if (capsError) {
    console.error('\nDetailed capabilities error:', capsError);
    throw new Error(`Error inserting profile capabilities: ${capsError.message}`);
  }

  console.log('Successfully inserted profile capabilities');

  // Insert profile skills
  const { data: insertedSkills, error: skillsError } = await supabase
    .from('profile_skills')
    .upsert(profileSkills)
    .select();

  if (skillsError) {
    console.error('\nDetailed skills error:', skillsError);
    throw new Error(`Error inserting profile skills: ${skillsError.message}`);
  }

  console.log('Successfully inserted profile skills');
  console.log(`\nTotal insertions successful:`);
  console.log(`- ${insertedProfiles?.length || 0} profiles`);
  console.log(`- ${insertedCapabilities?.length || 0} capabilities`);
  console.log(`- ${insertedSkills?.length || 0} skills`);
}

// Main function
async function main() {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
    }

    const count = parseInt(process.argv[2]) || 10;
    const data = await generateProfiles(count);

    // Validate generated data
    if (!data.profiles.length) {
      throw new Error('No profiles were generated');
    }

    await insertProfiles(data);
    console.log('Profile generation and insertion completed successfully!');
  } catch (error) {
    console.error('\nError details:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
main(); 