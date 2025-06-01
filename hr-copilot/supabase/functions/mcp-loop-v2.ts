/**
 * Step 3: Execute
 * Executes each planned action in sequence, updating context with results
 */
private async executeActions() {
  for (const action of this.plan) {
    try {
      // Validate action before execution
      await this.validateAction(action);

      const loadedTool = ActionV2Registry.loadToolWithArgs(action.tool, this.context, action.args);
      if (!loadedTool) {
        throw new Error(`Tool not found: ${action.tool}`);
      }

      // Generate request hash for deduplication
      const hashArray = generateRequestHash(loadedTool.args);
      const requestHash = Array.from(hashArray).join(',');
      console.log('Generated request hash:', { tool: action.tool, hash: requestHash });

      // Check for existing results
      const existingResult = await this.findExistingActionResult(action, requestHash);
      if (existingResult && this.isResultStillValid(existingResult, requestHash)) {
        console.log('Found matching cached result:', { 
          tool: action.tool, 
          hash: requestHash,
          age: Date.now() - new Date(existingResult.created_at).getTime()
        });

        this.intermediateResults.push({
          tool: action.tool,
          input: loadedTool.args,
          output: existingResult,
          success: true,
          reused: true
        });
        this.context[action.tool] = existingResult;
        continue;
      }

      // Include supabase client in the execution context
      const executionContext = {
        ...this.context,
        supabase: this.supabase
      };

      const result = await loadedTool.tool.run({
        context: executionContext,
        args: loadedTool.args
      });

      // Log action and result
      await this.logMcpStep(action, result, requestHash);

      // Store result
      this.intermediateResults.push({
        tool: action.tool,
        input: loadedTool.args,
        output: result,
        success: true
      });

      // Update context with result
      this.context[action.tool] = result;

    } catch (error) {
      console.error(`Action ${action.tool} failed:`, error);
      
      this.intermediateResults.push({
        tool: action.tool,
        input: action.args,
        output: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Log execution summary
  console.log('Actions executed:', {
    total: this.plan.length,
    successful: this.intermediateResults.filter(r => r.success).length,
    failed: this.intermediateResults.filter(r => !r.success).length,
    results: this.intermediateResults.map(r => ({
      tool: r.tool,
      success: r.success,
      error: r.error
    }))
  });
}

/**
 * Checks if a cached result is still valid
 */
private isResultStillValid(result: any, currentHash: string): boolean {
  if (!result) return false;

  // Check if the result has required fields
  if (!result.response || typeof result.response !== 'object') {
    console.log('Invalid result structure:', { responseType: typeof result.response });
    return false;
  }

  // Check if the hashes match by comparing their numeric values
  const storedHashArray = result.request_hash.split(',').map(Number);
  const currentHashArray = currentHash.split(',').map(Number);
  
  const hashesMatch = storedHashArray.length === currentHashArray.length &&
    storedHashArray.every((val, idx) => val === currentHashArray[idx]);

  if (!hashesMatch) {
    console.log('Hash mismatch:', { 
      stored: storedHashArray,
      current: currentHashArray
    });
    return false;
  }

  // Check if within cache duration
  const createdAt = new Date(result.created_at).getTime();
  const now = Date.now();
  if (now - createdAt > CACHE_DURATION_MS) {
    console.log('Result expired:', {
      age: now - createdAt,
      maxAge: CACHE_DURATION_MS
    });
    return false;
  }

  return true;
}

// /**
//  * Checks for existing action results that match the current request
//  */
// private async findExistingActionResult(
//   action: PlannedActionV2,
//   requestHash: string
// ): Promise<ActionResultV2 | null> {
//   if (!this.request.sessionId) return null;

//   console.log('Finding existing action result for:', {
//     session_id: this.request.sessionId,
//     action_type: action.tool,
//     request_hash: requestHash
//   });

//   const { data } = await this.supabase
//     .from('agent_actions')
//     .select('*')
//     .match({
//       session_id: this.request.sessionId,
//       action_type: action.tool
//     })
//     .order('created_at', { ascending: false })
//     .limit(5); // Get last 5 actions to check hashes

//   if (!data?.length) {
//     console.log('No recent actions found for:', action.tool);
//     return null;
//   }

//   // Find first valid result with matching hash
//   for (const result of data) {
//     if (this.isResultStillValid(result, requestHash)) {
//       console.log('Found valid cached result:', {
//         tool: action.tool,
//         hash: requestHash,
//         age: Date.now() - new Date(result.created_at).getTime()
//       });
//       return result.response;
//     }
//   }

//   console.log('No valid cached results found for:', action.tool);
//   return null;
// } 