import { ToolMetadataV2 } from '../types/action.ts';

/**
 * Converts an array to a CSV string with proper escaping
 * @param arr Array of values to join
 * @returns CSV string
 */
function escapeCSV(fields: string[]): string {
  return fields.map(field => {
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  }).join(',');
}

/**
 * Converts array fields (like roles, tags) into pipe-separated strings for compact CSV output.
 */
function formatField(value: string[] | string | undefined): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.join('|');
  return value;
}

/**
 * Formats an array of MCP tool metadata objects into a CSV string for use in AI prompts or exports.
 */
export function formatToolMetadataAsCSV(tools: ToolMetadataV2[]): string {
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

  // Header row
  const header = escapeCSV(columns as unknown as string[]);



  // Data rows
  const rows = tools.map(tool => {

    console.log("tool.requiredPrerequisites:", tool.name, ":", tool.requiredPrerequisites);
    const values = columns.map(col => {
      switch (col) {
        case 'id': return tool.name;
        case 'title': return tool.title;
        case 'description': return tool.description;
        case 'applicableRoles': return formatField(tool.applicableRoles);
        case 'capabilityTags': return formatField(tool.capabilityTags);
        case 'requiredInputs': return formatField(tool.requiredInputs);
        case 'tags': return formatField(tool.tags);
        case 'suggestedPrerequisites': return formatField(tool.suggestedPrerequisites);
        case 'suggestedPostrequisites': return formatField(tool.suggestedPostrequisites);
        case 'requiredPrerequisites': return formatField(tool.requiredPrerequisites);
        case 'usesAI': return tool.usesAI ? 'true' : 'false';
        default: return '';
      }
    });
    return escapeCSV(values);
  });

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