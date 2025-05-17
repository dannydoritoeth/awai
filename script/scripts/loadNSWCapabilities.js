const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function loadNSWCapabilities() {
  try {
    console.log('Loading NSW Capability Framework data...');

    // Load the seed data
    const categories = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../database/seed/nsw_capability_categories.json'), 'utf8')
    );
    const capabilities = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../database/seed/nsw_capabilities.json'), 'utf8')
    );
    const levels = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../database/seed/nsw_capability_levels.json'), 'utf8')
    );

    // Insert categories
    console.log('Inserting capability categories...');
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('capability_categories')
      .upsert(categories, { onConflict: 'id' });

    if (categoriesError) {
      throw new Error(`Error inserting categories: ${categoriesError.message}`);
    }

    // Insert capabilities
    console.log('Inserting capabilities...');
    const { data: capabilitiesData, error: capabilitiesError } = await supabase
      .from('capabilities')
      .upsert(capabilities, { onConflict: 'id' });

    if (capabilitiesError) {
      throw new Error(`Error inserting capabilities: ${capabilitiesError.message}`);
    }

    // Insert capability levels
    console.log('Inserting capability levels...');
    const { data: levelsData, error: levelsError } = await supabase
      .from('capability_levels')
      .upsert(levels, { onConflict: 'id' });

    if (levelsError) {
      throw new Error(`Error inserting levels: ${levelsError.message}`);
    }

    console.log('Successfully loaded NSW Capability Framework data!');
  } catch (error) {
    console.error('Error loading NSW Capability Framework data:', error);
    process.exit(1);
  }
}

loadNSWCapabilities(); 