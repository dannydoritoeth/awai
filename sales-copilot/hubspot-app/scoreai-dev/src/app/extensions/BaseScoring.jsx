import React, { useState, useEffect } from "react";
import {
  Button,
  Text,
  LoadingSpinner,
  Alert,
  Box,
  Flex,
  hubspot,
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

  // Load existing score and summary when component initializes
  useEffect(() => {
    loadExistingScore();
  }, []);

  // Function to fetch existing score from HubSpot
  const loadExistingScore = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get object type based on recordType
      let objectType;
      switch (recordType) {
        case 'contact': objectType = 'contacts'; break;
        case 'company': objectType = 'companies'; break;
        case 'deal': objectType = 'deals'; break;
        default: objectType = recordType + 's';
      }

      // First try to get the current HubSpot record
      try {
        const response = await hubspot.fetch(
          `https://api.hubapi.com/crm/v3/objects/${objectType}/${context.crm.objectId}?properties=ideal_client_score,ideal_client_summary`,
          {
            method: 'GET'
          }
        );

        const data = await response.json();
        
        if (data.properties) {
          if (data.properties.ideal_client_score) {
            setScore(data.properties.ideal_client_score);
          }
          if (data.properties.ideal_client_summary) {
            setSummary(data.properties.ideal_client_summary);
          }
        }
      } catch (hubspotError) {
        console.error('Error loading from HubSpot:', hubspotError);
        // Continue to try the Supabase function as a fallback
      }

      // Also try to get additional metadata from Supabase
      try {
        const summaryResponse = await hubspot.fetch(
          `${SUPABASE_SCORE_SUMMARY_URL}?portalId=${context.portal.id}&objectType=${recordType}&objectId=${context.crm.objectId}`,
          {
            method: 'GET'
          }
        );

        const summaryData = await summaryResponse.json();
        console.log('Score summary data:', summaryData);
        
        // If we didn't get data from HubSpot but have it in the summary, use that
        if (summaryData.success && summaryData.result && summaryData.result.currentRecord) {
          const currentRecord = summaryData.result.currentRecord;
          if (!score && currentRecord.ideal_client_score) {
            setScore(currentRecord.ideal_client_score);
          }
          if (!summary && currentRecord.ideal_client_summary) {
            setSummary(currentRecord.ideal_client_summary);
          }
        }
      } catch (summaryError) {
        console.error('Error loading summary:', summaryError);
        // This is just supplementary data, so we can continue without it
      }
    } catch (error) {
      console.error('Error in loadExistingScore:', error);
      // Don't set error state here, just log it - we want to allow scoring even if loading fails
    } finally {
      setLoading(false);
    }
  };

  // Simple function to handle scoring
  const handleScore = async () => {
    try {
      setScoring(true);
      setError(null);

      const response = await hubspot.fetch(
        `${SUPABASE_SCORE_RECORD_URL}?portalId=${context.portal.id}&recordType=${recordType}&recordId=${context.crm.objectId}`,
        {
          method: 'POST'
        }
      );

      const data = await response.json();

      if (data.success && data.result) {
        setScore(data.result.score);
        setSummary(data.result.summary);
      } else {
        setError(data.error || 'Unable to score record');
      }
    } catch (error) {
      setError('Error scoring record: ' + error.message);
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
            </>
          ) : (
            <Text>No score available</Text>
          )}
        </Box>

        <Button
          variant="primary"
          onClick={handleScore}
          loading={scoring}
        >
          {scoring ? 'Scoring...' : score ? `Rescore ${recordType}` : `Score ${recordType}`}
        </Button>
      </Flex>
    </Box>
  );
};

export default BaseScoring; 