import React, { useState, useEffect } from "react";
import {
  Button,
  Text,
  LoadingSpinner,
  Alert,
  Box,
  Flex,
  hubspot,
  Divider,
  Toggle,
} from "@hubspot/ui-extensions";

// Supabase function URLs
const SUPABASE_SCORE_RECORD_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-score-record';
const SUPABASE_SCORE_SUMMARY_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-score-summary';

const BaseScoring = ({ 
  context, 
  actions,
  recordType,
  title = "ScoreAI",
  objectTypeId = "0-2", // Default to company, can be overridden
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [summary, setSummary] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(true);

  // Load existing score when component initializes
  useEffect(() => {
    loadExistingScore();
  }, []);

  // Function to fetch existing score from Supabase
  const loadExistingScore = async () => {
    const summaryUrl = `${SUPABASE_SCORE_SUMMARY_URL}?portalId=${context.portal.id}&objectType=${recordType}&objectId=${context.crm.objectId}`;
    
    // Add request details to debug info
    setDebugInfo(prevDebug => ({
      ...prevDebug,
      summaryRequest: {
        url: summaryUrl,
        fullUrl: summaryUrl,
        params: {
          portalId: context.portal.id,
          objectType: recordType,
          objectId: context.crm.objectId
        }
      }
    }));
    
    try {
      setLoading(true);
      setError(null);

      // Get data from the Supabase score summary endpoint
      const summaryResponse = await hubspot.fetch(
        summaryUrl,
        {
          method: 'GET'
        }
      );

      // Add status code and headers to debug info
      setDebugInfo(prevDebug => ({
        ...prevDebug,
        summaryResponseStatus: summaryResponse.status,
        summaryResponseStatusText: summaryResponse.statusText,
      }));

      let summaryData;
      try {
        summaryData = await summaryResponse.json();
        console.log('Score summary data:', summaryData);
        
        // Update debug info
        setDebugInfo(prevDebug => ({
          ...prevDebug,
          summaryResponse: summaryData
        }));
      } catch (parseError) {
        // Handle JSON parse errors specifically
        const responseText = await summaryResponse.text().catch(() => "Could not read response text");
        setDebugInfo(prevDebug => ({
          ...prevDebug,
          parseError: parseError.message,
          responseText: responseText
        }));
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }
      
      if (summaryData.success && summaryData.result) {
        // Set plan information
        if (summaryData.result.plan) {
          setPlanInfo(summaryData.result.plan);
        }
        
        // Set scoring usage stats
        if (summaryData.result.scoring) {
          setUsageStats(summaryData.result.scoring);
        }
        
        // Set record score and summary
        if (summaryData.result.currentRecord) {
          const currentRecord = summaryData.result.currentRecord;
          if (currentRecord.ideal_client_score) {
            setScore(currentRecord.ideal_client_score);
          }
          if (currentRecord.ideal_client_summary) {
            setSummary(currentRecord.ideal_client_summary);
          }
        }
      } else if (summaryData.error) {
        setError(summaryData.error);
      }
    } catch (error) {
      console.error('Error in loadExistingScore:', error);
      setError('Unable to load score data. Please try again later.');
      setDebugInfo(prevDebug => ({
        ...prevDebug,
        loadError: error.message,
        loadErrorStack: error.stack,
        requestUrl: summaryUrl
      }));
    } finally {
      setLoading(false);
    }
  };

  // Simple function to handle scoring
  const handleScore = async () => {
    const scoreUrl = `${SUPABASE_SCORE_RECORD_URL}?portalId=${context.portal.id}&recordType=${recordType}&recordId=${context.crm.objectId}`;
    
    // Update debug info with request details
    setDebugInfo(prevDebug => ({
      ...prevDebug,
      scoreRequest: {
        url: scoreUrl,
        fullUrl: scoreUrl,
        params: {
          portalId: context.portal.id,
          recordType,
          recordId: context.crm.objectId
        }
      }
    }));
    
    try {
      setScoring(true);
      setError(null);

      const response = await hubspot.fetch(
        scoreUrl,
        {
          method: 'POST'
        }
      );
      
      // Add status code and headers to debug info
      setDebugInfo(prevDebug => ({
        ...prevDebug,
        scoreResponseStatus: response.status,
        scoreResponseStatusText: response.statusText,
      }));

      let data;
      try {
        data = await response.json();
        
        // Update debug info with response
        setDebugInfo(prevDebug => ({
          ...prevDebug,
          scoreResponse: data
        }));
      } catch (parseError) {
        // Handle JSON parse errors specifically
        const responseText = await response.text().catch(() => "Could not read response text");
        setDebugInfo(prevDebug => ({
          ...prevDebug,
          scoreParseError: parseError.message,
          scoreResponseText: responseText
        }));
        throw new Error(`Failed to parse score response: ${parseError.message}`);
      }

      if (data.success && data.result) {
        setScore(data.result.score);
        setSummary(data.result.summary);
        
        // Also refresh usage stats after scoring
        loadExistingScore();
      } else {
        setError(data.error || 'Unable to score record');
      }
    } catch (error) {
      setError('Error scoring record: ' + error.message);
      setDebugInfo(prevDebug => ({
        ...prevDebug,
        scoreError: error.message,
        scoreErrorStack: error.stack,
        scoreRequestUrl: scoreUrl
      }));
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <Box align="center" padding="md">
        <LoadingSpinner />
      </Box>
    );
  }

  return (
    <Box padding="md">
      <Flex direction="column" gap="md">
        {error && (
          <Alert title="Error" variant="error">
            {error}
          </Alert>
        )}

        <Box>
          {score ? (
            <>
              <Text format={{ fontWeight: "bold" }} variant="h1">
                {score}
              </Text>
              <Text>{summary}</Text>
              
              {usageStats && (
                <Box marginTop="md">
                  <Text format={{ fontWeight: "bold" }} variant="body">
                    Usage: {usageStats.used}/{usageStats.total} ({usageStats.remaining} remaining)
                  </Text>
                </Box>
              )}
            </>
          ) : (
            <Text>No score available</Text>
          )}
        </Box>

        <Button
          variant="secondary"
          onClick={handleScore}
          loading={scoring}
        >
          {scoring ? 'Scoring...' : score ? `Rescore ${recordType}` : `Score ${recordType}`}
        </Button>
        
        <Flex gap="md" alignItems="center">
          <Toggle 
            checked={showDebug}
            onChange={value => setShowDebug(value)}
          />
          <Text>Show Debug Info</Text>
        </Flex>
        
        {showDebug && (
          <>
            <Divider />
            
            <Box>
              <Text format={{ fontWeight: "bold" }}>Debug Information</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(debugInfo, null, 2)}
              </Text>
              
              <Divider />
              
              <Text format={{ fontWeight: "bold" }}>Request URL:</Text>
              <Text format={{ fontFamily: "monospace" }}>
                {`${SUPABASE_SCORE_SUMMARY_URL}?portalId=${context.portal.id}&objectType=${recordType}&objectId=${context.crm.objectId}`}
              </Text>

              <Divider />

              <Text format={{ fontWeight: "bold" }}>Plan Information:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(planInfo, null, 2)}
              </Text>

              <Divider />

              <Text format={{ fontWeight: "bold" }}>Usage Stats:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(usageStats, null, 2)}
              </Text>

              <Divider />

              <Text format={{ fontWeight: "bold" }}>Context:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify({ 
                  portalId: context.portal.id, 
                  objectId: context.crm.objectId,
                  recordType
                }, null, 2)}
              </Text>
            </Box>
          </>
        )}
      </Flex>
    </Box>
  );
};

export default BaseScoring; 