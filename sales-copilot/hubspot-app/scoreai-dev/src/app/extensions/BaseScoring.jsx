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
  Link,
} from "@hubspot/ui-extensions";
import { SUPABASE_URL } from "./config";

// Supabase function URLs
const SUPABASE_SCORE_RECORD_URL = `${SUPABASE_URL}/functions/v1/hubspot-score-record`;
const SUPABASE_SCORE_SUMMARY_URL = `${SUPABASE_URL}/functions/v1/hubspot-score-summary`;

const UsageStats = ({ usageStats, planInfo, portalId }) => {
  if (!usageStats) return null;

  const upgradeUrl = `https://acceleratewith.ai/pricing?portal_id=${portalId}`;
  const isFree = planInfo?.tier === 'free';
  const isLowOnScores = usageStats.remaining <= 50;
  
  let upgradeMessage = 'Need more scores?';
  if (isFree) {
    upgradeMessage = 'Upgrade to score more';
  } else if (isLowOnScores) {
    upgradeMessage = 'Running low? Get more scores';
  } else {
    upgradeMessage = 'Increase your scoring limit';
  }
  
  return (
    <Box>
      <Flex direction="column" gap="xs">
        <Text format={{ fontSize: "sm", color: "gray" }}>
          {usageStats.used} of {usageStats.total} scores used this period
        </Text>
        <Text format={{ fontSize: "sm", color: "gray" }}>
          <Link href={upgradeUrl} target="_blank">
            {upgradeMessage}
          </Link>
        </Text>
      </Flex>
    </Box>
  );
};

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
    const summaryUrl = `${SUPABASE_SCORE_SUMMARY_URL}?portal_id=${context.portal.id}&object_type=${recordType}&object_id=${context.crm.objectId}`;
    
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

      // Submit the scoring request without waiting for response
      const scoreUrl = `${SUPABASE_SCORE_RECORD_URL}?portal_id=${context.portal.id}&object_type=${recordType}&object_id=${context.crm.objectId}`;
      hubspot.fetch(scoreUrl, { method: 'POST' });
      
      setScoringStatus('Analyzing record...');
      
      // Start polling immediately
      const pollInterval = setInterval(async () => {
        try {
          const summaryUrl = `${SUPABASE_SCORE_SUMMARY_URL}?portal_id=${context.portal.id}&object_type=${recordType}&object_id=${context.crm.objectId}`;
          const summaryResponse = await hubspot.fetch(summaryUrl, { method: 'GET' });
          const summaryData = await summaryResponse.json();
          
          if (summaryData.success && summaryData.result) {
            const currentRecord = summaryData.result.currentRecord;
            if (currentRecord?.ideal_client_score && currentRecord.ideal_client_score !== score) {
              clearInterval(pollInterval);
              setScoring(false);
              setScoringStatus(null);
              updateStateFromSummary(summaryData.result);
            }
          }
        } catch (error) {
          console.error('Error polling score:', error);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup interval after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        if (scoring) {
          setScoring(false);
          setScoringStatus(null);
          setError('Scoring is taking longer than expected. Please check back later.');
        }
      }, 60000); // Changed from 120000 to 60000 (60 seconds) as requested

    } catch (error) {
      setError('Error starting scoring process. Please try again later.');
      setScoringStatus(null);
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
              <Flex direction="column" gap="md">
                {summary?.split('\n\n').map((section, sectionIndex) => (
                  <Flex key={sectionIndex} direction="column">
                    {section.split('\n').map((line, lineIndex) => (
                      <Text key={`${sectionIndex}-${lineIndex}`} format={{ lineHeight: "1.1" }}>
                        {line}
                      </Text>
                    ))}
                  </Flex>
                ))}
              </Flex>
            </>
          ) : (
            <Text>No score available</Text>
          )}
        </Box>

        {scoring && (
          <Text format={{ fontWeight: "bold" }}>{scoringStatus}</Text>
        )}

        <Button
          variant="secondary"
          onClick={handleScore}
          loading={scoring}
          disabled={scoring}
        >
          {scoring ? 'Scoring in progress...' : 'Score Now'}
        </Button>

        <UsageStats 
          usageStats={usageStats} 
          planInfo={planInfo}
          portalId={context.portal.id}
        />

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
                {`${SUPABASE_SCORE_SUMMARY_URL}?portal_id=${context.portal.id}&object_type=${recordType}&object_id=${context.crm.objectId}`}
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