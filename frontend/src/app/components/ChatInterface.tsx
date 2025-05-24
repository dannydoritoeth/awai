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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      setHasUserInteracted(true); // Mark as interacted when user sends a message
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }; 