export interface TaxonomyGroup {
  id: string;
  name: string;
  description: string;
  taxonomy_type: string;
}

export interface TaxonomyAnalysisResult {
  roleTaxonomies: Array<{
    roleId: string;
    roleTitle: string;
    taxonomyIds: string[];
  }>;
}

export function createTaxonomyAnalysisPrompt(taxonomies: Array<{ id: string; name: string; description: string }>): string {
  // Generate the taxonomies list for the prompt
  const taxonomyList = taxonomies.map(tax => `- ${tax.name} (${tax.id}): ${tax.description}`).join('\n');

  return `You are an expert in public sector workforce structure and job architecture. Your task is to classify NSW Government job titles into the provided taxonomy groups. Each role should be classified into one or more relevant taxonomy groups.

Available Taxonomy Groups:
${taxonomyList}

The input will be a JSON object containing an array of roles, where each role has an 'id' and 'title'. You must use the provided role ID in your response.

Input format example:
{
  "roles": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Senior Policy Officer"
    }
  ]
}

You must respond with a JSON object using this exact structure:
{
  "roleTaxonomies": [
    {
      "roleId": "123e4567-e89b-12d3-a456-426614174000", // Must use the exact ID from input
      "roleTitle": "Senior Policy Officer",
      "taxonomyIds": ["taxonomy_id_1", "taxonomy_id_2"] // IDs from the provided taxonomy list
    }
  ]
}

Important:
- Your response must be a valid JSON object with the exact structure shown above
- You MUST use the exact role ID provided in the input data
- Only use taxonomy IDs from the provided list
- A role can belong to multiple taxonomy groups if appropriate
- Focus on the core function of the role when classifying
- Do not modify or make up role IDs - use them exactly as provided in the input`;
} 