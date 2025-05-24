import { ToolMetadataV2 } from '../types/action.ts';

/**
 * Converts an array to a CSV string with proper escaping
 * @param arr Array of values to join
 * @returns CSV string
 */
function escapeCSV(arr: any[]): string {
  return arr.map(val => {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return `"${val.join(', ')}"`;
    if (typeof val === 'object') return `"${JSON.stringify(val)}"`;
    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return String(val);
  }).join(',');
}

/**
 * Formats tool metadata as a CSV string for use in prompts and displays
 * @param tools Array of tool metadata
 * @returns CSV string with header row
 */
export function formatToolMetadataAsCSV(tools: ToolMetadataV2[]): string {
  // Define the columns we want to include and their order
  const columns = [
    'id',
    'title',
    'description',
    'applicableRoles',
    'capabilityTags',
    'requiredInputs',
    'tags',
    'suggestedPrerequisites',
    'suggestedPostrequisites',
    'requiredPrerequisites',
    'usesAI'
  ] as const;

  // Create header row
  const header = escapeCSV(columns);

  // Create data rows
  const rows = tools.map(tool => {
    const values = columns.map(col => {
      switch (col) {
        case 'id':
          return tool.name;
        case 'title':
          return tool.title;
        case 'description':
          return tool.description;
        case 'applicableRoles':
          return tool.applicableRoles;
        case 'capabilityTags':
          return tool.capabilityTags;
        case 'requiredInputs':
          return tool.requiredInputs;
        case 'tags':
          return tool.tags || [];
        case 'suggestedPrerequisites':
          return tool.suggestedPrerequisites || [];
        case 'suggestedPostrequisites':
          return tool.suggestedPostrequisites || [];
        case 'requiredPrerequisites':
          return tool.requiredPrerequisites || [];
        case 'usesAI':
          return tool.usesAI ? 'true' : 'false';
      }
    });
    return escapeCSV(values);
  });

  // Combine header and rows
  return [header, ...rows].join('\n');
}

/**
 * Formats tool metadata as a markdown table for documentation
 * @param tools Array of tool metadata
 * @returns Markdown table string
 */
export function formatToolMetadataAsMarkdown(tools: ToolMetadataV2[]): string {
  const columns = [
    { key: 'name', header: 'Tool' },
    { key: 'description', header: 'Description' },
    { key: 'applicableRoles', header: 'Roles' },
    { key: 'requiredInputs', header: 'Required Inputs' }
  ] as const;

  // Create header
  const header = `| ${columns.map(col => col.header).join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;

  // Create rows
  const rows = tools.map(tool => {
    const values = columns.map(col => {
      const value = tool[col.key];
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return value || '';
    });
    return `| ${values.join(' | ')} |`;
  });

  return [header, separator, ...rows].join('\n');
} 