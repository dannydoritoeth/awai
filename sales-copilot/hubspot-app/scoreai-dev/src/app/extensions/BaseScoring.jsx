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
const SUPABASE_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co';
const SUPABASE_SCORE_RECORD_URL = `${SUPABASE_URL}/functions/v1/hubspot-score-record`;
const SUPABASE_SCORE_SUMMARY_URL = `${SUPABASE_URL}/functions/v1/hubspot-score-summary`;

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
  const [showDebug, setShowDebug] = useState(false);
  const [scoringStatus, setScoringStatus] = useState(null);
  const [scoringProgress, setScoringProgress] = useState(0);

  // Load existing score when component initializes
  useEffect(() => {
    loadExistingScore();
  }, []);

  const updateStateFromSummary = (result) => {
    // Set plan information
    if (result.plan) {
      setPlanInfo(result.plan);
    }
    
    // Set scoring usage stats
    if (result.scoring) {
      setUsageStats(result.scoring);
    }
    
    // Set record score and summary
    if (result.currentRecord) {
      const currentRecord = result.currentRecord;
      if (currentRecord.ideal_client_score) {
        setScore(currentRecord.ideal_client_score);
      }
      if (currentRecord.ideal_client_summary) {
        setSummary(currentRecord.ideal_client_summary);
      }
    }
  };

  // Function to fetch existing score from Supabase
  const loadExistingScore = async () => {
    const summaryUrl = `${SUPABASE_SCORE_SUMMARY_URL}?portalId=${context.portal.id}&objectType=${recordType}&objectId=${context.crm.objectId}`;
    
    try {
      setLoading(true);
      setError(null);

      const summaryResponse = await hubspot.fetch(summaryUrl, { method: 'GET' });
      const summaryData = await summaryResponse.json();
      
      if (summaryData.success && summaryData.result) {
        updateStateFromSummary(summaryData.result);
      } else if (summaryData.error) {
        setError(summaryData.error);
      }
    } catch (error) {
      console.error('Error in loadExistingScore:', error);
      setError('Unable to load score data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleScore = async () => {
    try {
      setScoring(true);
      setError(null);
      setScoringStatus('Starting scoring process...');
      setScoringProgress(0);

      // Submit the scoring request
      const scoreUrl = `${SUPABASE_SCORE_RECORD_URL}?portalId=${context.portal.id}&recordType=${recordType}&recordId=${context.crm.objectId}`;
      const response = await hubspot.fetch(scoreUrl, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setScoringStatus('Analyzing record...');
        setScoringProgress(20);
        
        // Poll score-summary for updates
        const pollInterval = setInterval(async () => {
          try {
            const summaryUrl = `${SUPABASE_SCORE_SUMMARY_URL}?portalId=${context.portal.id}&objectType=${recordType}&objectId=${context.crm.objectId}`;
            const summaryResponse = await hubspot.fetch(summaryUrl, { method: 'GET' });
            const summaryData = await summaryResponse.json();
            
            if (summaryData.success && summaryData.result) {
              const currentRecord = summaryData.result.currentRecord;
              if (currentRecord?.ideal_client_score && currentRecord.ideal_client_score !== score) {
                clearInterval(pollInterval);
                setScoring(false);
                setScoringStatus(null);
                setScoringProgress(0);
                updateStateFromSummary(summaryData.result);
              }
            }
          } catch (error) {
            console.error('Error polling score:', error);
          }
        }, 2000); // Poll every 2 seconds

        // Cleanup interval after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (scoring) {
            setScoring(false);
            setScoringStatus(null);
            setScoringProgress(0);
            setError('Scoring is taking longer than expected. Please check back later.');
          }
        }, 120000);
      } else {
        setError(data.error || 'Unable to start scoring process. Please try again.');
        setScoringStatus(null);
        setScoringProgress(0);
      }
    } catch (error) {
      setError('Error starting scoring process. Please try again later.');
      setScoringStatus(null);
      setScoringProgress(0);
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <Box align="center" padding="md">
        <LoadingSpinner />
        <Text format={{ fontWeight: "bold" }}>Loading score data...</Text>
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
          disabled={scoring}
        >
          {scoring ? 'Scoring in progress...' : 'Score Now'}
        </Button>

        {scoring && (
          <>
            <Text format={{ fontWeight: "bold" }}>{scoringStatus}</Text>
            <Box>
              <Text>Progress: {scoringProgress}%</Text>
              <Box 
                style={{ 
                  width: '100%', 
                  height: '4px', 
                  backgroundColor: '#f0f0f0',
                  borderRadius: '2px',
                  marginTop: '4px'
                }}
              >
                <Box 
                  style={{ 
                    width: `${scoringProgress}%`, 
                    height: '100%', 
                    backgroundColor: '#2d7ff9',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease-in-out'
                  }}
                />
              </Box>
            </Box>
          </>
        )}
        
        {/* <Flex gap="md" alignItems="center">
          <Toggle 
            checked={showDebug}
            onChange={value => setShowDebug(value)}
          />
          <Text>Show Debug Info</Text>
        </Flex> */}
        
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