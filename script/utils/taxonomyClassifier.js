import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';

const systemPrompt = `You are an expert in public sector workforce structure and job architecture. Your task is to classify job titles into high-level role taxonomy groups. Use ONLY the following taxonomy groups:

- Policy & Research
- Field Operations
- Project & Program Delivery
- Legal & Regulatory
- Scientific & Technical
- ICT & Digital
- HR & People
- Finance & Accounting
- Procurement & Commercial
- Executive & Leadership
- Customer Service
- Administrative Support
- Communications & Marketing
- Data & Analytics
- Engineering & Infrastructure

For each role, assign 1-2 most relevant taxonomy groups based on the role's primary functions and responsibilities.`;

const suggestedTaxonomies = `
Policy
Field Operations
Project Delivery
Legal
Environmental Science
ICT & Digital
HR & Workforce
Finance
Procurement & Contracts
Executive & Leadership
Customer Service
Administrative Support`;

const userPromptTemplate = `Please classify this role into 1-2 taxonomy groups from the predefined list above.

Role Title: {title}
Department: {department}
Description: {description}

Return ONLY a valid JSON object with this exact structure:
{
  "classifications": [
    {
      "roleTitle": "exact role title",
      "taxonomyGroups": ["primary group", "optional secondary group"],
      "confidence": "HIGH/MEDIUM/LOW"
    }
  ]
}`;

export async function classifyRole(openai, role) {
  try {
    logger.info(`Classifying role: ${role.title}`);

    const userPrompt = userPromptTemplate
      .replace('{title}', role.title)
      .replace('{department}', role.department || 'Not specified')
      .replace('{description}', role.primary_purpose || role.raw_data?.description || 'Not specified');

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.3
    });

    const response = JSON.parse(completion.choices[0].message.content);
    logger.info(`Classification result for "${role.title}":`, {
      taxonomyGroups: response.classifications[0].taxonomyGroups,
      confidence: response.classifications[0].confidence
    });
    return response.classifications[0];
  } catch (error) {
    logger.error('Error classifying role:', {
      error: error instanceof Error ? error.message : String(error),
      role: role.title
    });
    return null;
  }
}

export async function processTaxonomies(supabase, roles, openai) {
  try {
    logger.info(`Starting taxonomy processing for ${roles.length} roles...`);
    
    if (!roles || roles.length === 0) {
      logger.warn('No roles to process for taxonomies');
      return {
        taxonomiesCreated: 0,
        roleTaxonomiesCreated: 0,
        rolesProcessed: 0,
        rolesSkipped: 0
      };
    }

    const timestamp = new Date().toISOString();
    const taxonomyMap = new Map(); // name -> { id, name, description }
    const taxonomyLinks = [];

    // First, get existing taxonomies to avoid duplicates
    const { data: existingTaxonomies, error: fetchError } = await supabase
      .from('taxonomy')
      .select('id, name');

    if (fetchError) {
      throw fetchError;
    }

    logger.info(`Found ${existingTaxonomies.length} existing taxonomies`);
    logger.debug('Existing taxonomy names:', existingTaxonomies.map(t => t.name).join(', '));

    // Create a map of existing taxonomies
    for (const tax of existingTaxonomies) {
      taxonomyMap.set(tax.name, {
        id: tax.id,
        name: tax.name,
        description: `Roles related to ${tax.name.toLowerCase()}`,
        taxonomy_type: 'core',
        created_at: timestamp,
        updated_at: timestamp
      });
    }

    // Process each role in batches
    const batchSize = 5;
    let totalClassified = 0;
    let totalSkipped = 0;
    let newTaxonomies = [];

    for (let i = 0; i < roles.length; i += batchSize) {
      const batch = roles.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(roles.length/batchSize)}`);
      logger.info(`Processing roles: ${batch.map(r => r.title).join(', ')}`);
      
      // Classify each role in the batch
      const classifications = await Promise.all(
        batch.map(async (role) => {
          logger.info(`Classifying role: ${role.title}`);
          const classification = await classifyRole(openai, role);
          if (classification) {
            logger.info(`Role "${role.title}" classified into groups: ${classification.taxonomyGroups.join(', ')}`);
          } else {
            logger.warn(`Failed to classify role: ${role.title}`);
          }
          return { roleId: role.id, ...classification };
        })
      );

      // Process classifications and create taxonomy records
      for (const classification of classifications) {
        if (!classification || !classification.taxonomyGroups) {
          logger.warn(`Skipping role ${classification?.roleTitle || 'unknown'} - no taxonomy groups assigned`);
          totalSkipped++;
          continue;
        }

        totalClassified++;
        for (const taxonomyName of classification.taxonomyGroups) {
          // Skip empty taxonomy names
          if (!taxonomyName) {
            logger.warn(`Empty taxonomy name found for role ${classification.roleTitle}`);
            continue;
          }

          // Create taxonomy if it doesn't exist
          if (!taxonomyMap.has(taxonomyName)) {
            const taxonomyId = uuidv4();
            logger.info(`Creating new taxonomy: ${taxonomyName} (${taxonomyId})`);
            const newTaxonomy = {
              id: taxonomyId,
              name: taxonomyName,
              description: `Roles related to ${taxonomyName.toLowerCase()}`,
              taxonomy_type: 'core',
              created_at: timestamp,
              updated_at: timestamp,
              sync_status: 'pending',
              last_synced_at: null
            };
            taxonomyMap.set(taxonomyName, newTaxonomy);
            newTaxonomies.push(newTaxonomy);
          }

          // Create taxonomy link
          const taxonomy = taxonomyMap.get(taxonomyName);
          logger.debug(`Creating link: Role "${classification.roleTitle}" -> Taxonomy "${taxonomyName}" (${taxonomy.id})`);
          taxonomyLinks.push({
            role_id: classification.roleId,
            taxonomy_id: taxonomy.id,
            created_at: timestamp,
            updated_at: timestamp,
            sync_status: 'pending',
            last_synced_at: null
          });
        }
      }

      // Add a small delay between batches to respect rate limits
      if (i + batchSize < roles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Insert new taxonomies
    if (newTaxonomies.length > 0) {
      logger.info(`Creating ${newTaxonomies.length} new taxonomies:`, 
        newTaxonomies.map(t => t.name).join(', '));

      const { error: taxonomyError } = await supabase
        .from('taxonomy')
        .upsert(newTaxonomies);

      if (taxonomyError) {
        throw taxonomyError;
      }
      logger.info(`Successfully created ${newTaxonomies.length} new taxonomies`);
    }

    // Upsert taxonomy links
    if (taxonomyLinks.length > 0) {
      logger.info(`Creating ${taxonomyLinks.length} role-taxonomy links`);

      const { error: linkError } = await supabase
        .from('role_taxonomies')
        .upsert(taxonomyLinks, { 
          onConflict: 'role_id,taxonomy_id',
          ignoreDuplicates: false 
        });

      if (linkError) {
        throw linkError;
      }
      logger.info(`Successfully created ${taxonomyLinks.length} role-taxonomy links`);
    }

    const results = {
      taxonomiesCreated: newTaxonomies.length,
      roleTaxonomiesCreated: taxonomyLinks.length,
      rolesProcessed: totalClassified,
      rolesSkipped: totalSkipped
    };

    logger.info('Taxonomy processing completed', results);

    return results;
  } catch (error) {
    logger.error('Error processing taxonomies:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 