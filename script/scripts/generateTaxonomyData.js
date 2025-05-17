import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

// Example taxonomy groups from the prompt - these are just suggestions for the AI
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
Administrative Support
`;

// The system prompt from JobImportandTaxonomyClassfication-Prompt.md
const systemPrompt = `You are an expert in public sector workforce structure and job architecture. Your task is to classify NSW Government job titles into high-level role taxonomy groups, such as "Policy", "Field Operations", "Legal", "Project Delivery", "Scientific & Technical", or similar categories commonly used in government talent frameworks. Group roles based on their function, not just keywords.`;

// The user prompt template
const userPromptTemplate = `Below is a list of NSW Government role titles. Please classify each one into a suitable taxonomy group (1–2 words). If a title is ambiguous, choose the best general-purpose grouping.

Here are some examples of taxonomy groupings you might use (you can add or adapt these based on the role):

${suggestedTaxonomies}

Return ONLY a valid JSON object with this exact structure:
{
  "classifications": [
    {
      "roleTitle": "exact role title from input",
      "taxonomyGroups": ["primary group", "optional secondary group"]
    },
    ...
  ]
}

Role titles to classify:
{{ROLE_TITLES}}`;

async function classifyRolesWithAI(roles) {
  // Initialize OpenAI client
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is required for taxonomy classification. Please ensure OPENAI_API_KEY is set in your .env file.');
  }
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Process roles in batches to avoid token limits
  const batchSize = 20;
  const results = [];
  
  for (let i = 0; i < roles.length; i += batchSize) {
    const batch = roles.slice(i, i + batchSize);
    const roleTitles = batch.map(r => r.title).join('\n');
    
    // Prepare the prompt
    const prompt = userPromptTemplate.replace('{{ROLE_TITLES}}', roleTitles);
    
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(roles.length/batchSize)}`);
    console.log('Sample roles from this batch:');
    batch.slice(0, 3).forEach(r => console.log(`- ${r.title}`));
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      let response;
      try {
        response = JSON.parse(completion.choices[0].message.content);
        console.log('Successfully parsed OpenAI response:', response);
      } catch (error) {
        console.error('Failed to parse OpenAI response:', completion.choices[0].message.content);
        console.error('Parse error:', error);
        continue;
      }
      
      if (!response.classifications || !Array.isArray(response.classifications)) {
        console.error('Invalid response format from OpenAI. Expected classifications array.');
        console.error('Response:', response);
        continue;
      }
      
      // Map the AI classifications back to the role IDs
      response.classifications.forEach((classification, index) => {
        if (index < batch.length) { // Ensure we don't exceed batch size
          results.push({
            roleId: batch[index].id,
            roleTitle: classification.roleTitle,
            taxonomyGroups: classification.taxonomyGroups || []
          });
        }
      });
      
      // Add a small delay between batches to respect rate limits
      if (i + batchSize < roles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      // Continue with next batch despite errors
    }
  }
  
  return results;
}

async function generateTaxonomyData(roles) {
  const taxonomies = new Map(); // name -> { id, name, description }
  const taxonomyLinks = [];
  const timestamp = new Date().toISOString();

  // Get AI classifications for all roles
  const classifications = await classifyRolesWithAI(roles);

  // Process each classification
  for (const classification of classifications) {
    for (const taxonomyName of classification.taxonomyGroups) {
      // Create taxonomy if it doesn't exist
      if (!taxonomies.has(taxonomyName)) {
        taxonomies.set(taxonomyName, {
          id: uuidv4(),
          name: taxonomyName,
          description: `Roles related to ${taxonomyName.toLowerCase()}`,
          taxonomy_type: 'core',
          created_at: timestamp,
          updated_at: timestamp
        });
      }

      // Create taxonomy link
      const taxonomy = taxonomies.get(taxonomyName);
      taxonomyLinks.push({
        role_id: classification.roleId,
        taxonomy_id: taxonomy.id,
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }

  return {
    taxonomies: Array.from(taxonomies.values()),
    taxonomyLinks
  };
}

async function writeToFile(data, filename) {
  const filePath = path.join(__dirname, '../database/seed', filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Generated ${filename}`);
}

async function generateTaxonomyFiles() {
  try {
    // Read the roles file to get all role titles
    const rolesPath = path.join(__dirname, '../database/seed/roles.json');
    const roles = JSON.parse(await fs.readFile(rolesPath, 'utf8'));

    const { taxonomies, taxonomyLinks } = await generateTaxonomyData(roles);
    
    await writeToFile(taxonomies, 'taxonomy.json');
    await writeToFile(taxonomyLinks, 'role_taxonomies.json');
    
    console.log(`Generated ${taxonomies.length} taxonomies and ${taxonomyLinks.length} taxonomy links`);
  } catch (error) {
    console.error('Error generating taxonomy data:', error);
  }
}

// Export for use in prepareSeedData
export { generateTaxonomyData }; 