  // Prepare flattened request body
  const requestBody = {
    action: 'postMessage',
    sessionId,
    message,
    actionId: actionData.actionId,
    ...actionData.params,
    // Ensure profileId is included if it exists in actionData.params
    ...(actionData.params.profileId && { profileId: actionData.params.profileId })
  };

  console.log('Sending action request:', requestBody);

  // Execute the action through chat endpoint 