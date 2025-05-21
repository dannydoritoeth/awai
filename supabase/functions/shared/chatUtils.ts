/**
 * Create the MCP loop request body
 */
export function createMCPLoopBody(
  mode: 'candidate' | 'hiring' | 'general' | 'analyst',
  sessionId: string,
  message: string,
  entityId?: string,
  insightId?: string,
  scope?: string,
  companyIds?: string[],
  actionData?: {
    actionId: string;
    params: Record<string, any>;
  }
) {
  // Extract all params from actionData if present
  const actionParams = actionData?.params || {};
  
  // Create flattened base context
  const baseContext = {
    lastMessage: message,
    mode,
    chatHistory: [],
    agentActions: [],
    summary: '',
    semanticContext: {
      previousMatches: []
    },
    contextEmbedding: [],
    // Flatten all action params into context
    ...actionParams
  };

  // Create flattened body with all parameters at top level
  const body = {
    mode,
    sessionId,
    // Flatten all action params at top level first
    ...actionParams,
    // Then add mode-specific IDs, but don't overwrite roleId/profileId from actionParams
    ...(mode === 'candidate' && !actionParams.profileId ? { profileId: entityId } : {}),
    ...(mode === 'hiring' && !actionParams.roleId ? { roleId: entityId } : {}),
    // Include actionId if present
    ...(actionData?.actionId && { actionId: actionData.actionId }),
    context: baseContext
  };

  // Add analyst-specific fields if in analyst mode
  if (mode === 'analyst') {
    const analystBody = {
      ...body,
      insightId,
      companyIds: companyIds || [entityId],
      context: {
        ...baseContext,
        companyIds: companyIds || [entityId],
        scope: scope || 'division',
        outputFormat: 'action_plan'
      },
      plannerRecommendations: []
    };

    console.log('MCP Loop V2 Request (Analyst):', JSON.stringify(analystBody, null, 2));
    return analystBody;
  }

  console.log('MCP Loop V2 Request:', JSON.stringify(body, null, 2));
  return body;
} 