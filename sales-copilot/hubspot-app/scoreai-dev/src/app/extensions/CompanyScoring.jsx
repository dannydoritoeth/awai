import React, { useState, useEffect } from "react";
import {
  Button,
  Text,
  LoadingSpinner,
  Alert,
  Box,
  Divider,
  Heading,
  Link,
  Flex,
  hubspot,
} from "@hubspot/ui-extensions";

// Constants
const REQUIRED_TRAINING_COUNT = 10;

// Supabase function URLs
const SUPABASE_SCORE_RECORD_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-score-record';
const SUPABASE_GET_TRAINING_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-get-training-counts';

// Main Extension Component
const Extension = ({ context, actions }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [summary, setSummary] = useState(null);
  const [canScore, setCanScore] = useState(false);
  const [trainingCounts, setTrainingCounts] = useState({ high: 0, low: 0 });
  const [scoring, setScoring] = useState(false);
  const [trainingError, setTrainingError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(false);


  useEffect(() => {
    checkCanScore();
  }, []);

  const checkCanScore = async () => {
    try {
      console.log('Starting checkCanScore with context:', context);
      setLoading(true);
      setError(null);

      // Get training counts from Supabase Edge function
      const response = await hubspot.fetch(
        `${SUPABASE_GET_TRAINING_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}`, 
        {
          method: 'POST'
        },
        // headers: {
        //   'Content-Type': 'application/json',
        //   'Authorization': `Bearer ${accessToken}`
        // },
      );

      const data = await response.json();
      console.log('Raw response data:', data);
      console.log('Current record from response:', data.result.currentRecord);
      setDebugInfo(prev => {
        console.log('Previous debug info:', prev);
        const newDebugInfo = { ...prev, trainingData: data };
        console.log('New debug info:', newDebugInfo);
        return newDebugInfo;
      });

      if (data.success) {
        const { companies } = data.result;
        const hasEnoughTraining = companies.current.ideal >= companies.required.ideal && 
                                 companies.current.less_ideal >= companies.required.less_ideal;
        
        setTrainingCounts({ 
          high: companies.current.ideal || 0, 
          low: companies.current.less_ideal || 0 
        });
        setCanScore(hasEnoughTraining);

        // Set debug info
        setDebugInfo({
          trainingData: data,
          scoreResponse: debugInfo.scoreResponse
        });

        // Set training error if not enough records
        if (!hasEnoughTraining) {
          setTrainingError({
            current: {
              ideal_companies: companies.current.ideal,
              less_ideal_companies: companies.current.less_ideal
            },
            required: {
              ideal_companies: companies.required.ideal,
              less_ideal_companies: companies.required.less_ideal
            }
          });
        } else {
          setTrainingError(null);
        }

        // Get current score if available
        if (data.result.currentRecord?.ideal_client_score) {
          setScore(data.result.currentRecord.ideal_client_score);
          setSummary(data.result.currentRecord.ideal_client_summary || '');
        }
      } else {
        throw new Error(data.error || 'Failed to get training counts');
      }
    } catch (error) {
      console.error('Error in checkCanScore:', error);
      setError('Failed to check scoring status', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScore = async () => {
    try {
      setScoring(true);
      setTrainingError(null);

      const response = await hubspot.fetch(
        `${SUPABASE_SCORE_RECORD_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}`,
        {
          method: 'POST'
        }
      );

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response from server. Please try again.');
      }

      console.log('Score response:', data);
      setDebugInfo(prev => ({ ...prev, scoreResponse: data }));

      if (data.success) {
        if (data.result.score) {
          setScore(data.result.score);
          setSummary(data.result.summary);
        }
        // Always refresh data after successful scoring
        await checkCanScore();
      } else {
        setTrainingError({
          message: data.error || 'Unable to score at this time. Please try again.',
          details: data.details
        });
      }
    } catch (error) {
      console.error('Scoring error:', error);
      setTrainingError({
        message: error.message || 'Unable to score at this time. Please try again.'
      });
    } finally {
      setScoring(false);
    }
  };

  const getHighScoreUrl = () => {
    if (!context?.portal?.id) return '#';
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/0-2/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22GTE%22%2C%22value%22%3A%2280%22%7D%5D`;
  };

  const getLowScoreUrl = () => {
    if (!context?.portal?.id) return '#';
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/0-2/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22LT%22%2C%22value%22%3A%2250%22%7D%5D`;
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

        <Divider />

        <Box>
          {trainingError && (
            <Alert variant="warning">
              {trainingError.message ? (
                <Text>{trainingError.message}</Text>
              ) : (
                <Box>
                  <Text format={{ fontSize: "md", fontWeight: "bold" }}>More training data needed to score this company</Text>
                  <Box margin={{ bottom: "sm" }}>
                    <Text>You will need:</Text>
                  </Box>
                  <Box margin={{ left: "md" }}>
                    <Box margin={{ bottom: "xs" }}>
                      <Text>
                        • At least {trainingError.required.ideal_companies} records with scores above 80
                        {' '}
                        (you currently have <Link href={getHighScoreUrl()}>{trainingError.current.ideal_companies} high scores</Link>)
                      </Text>
                    </Box>
                    <Box margin={{ bottom: "sm" }}>
                      <Text>
                        • At least {trainingError.required.less_ideal_companies} records with scores below 50
                        {' '}
                        (you currently have <Link href={getLowScoreUrl()}>{trainingError.current.less_ideal_companies} low scores</Link>)
                      </Text>
                    </Box>
                  </Box>
                  <Divider margin={{ top: "md", bottom: "md" }} />
                  <Text>
                    Instructions for adding training records can be found <Link href="https://acceleratewith.ai/app-success">here</Link>.
                  </Text>
                </Box>
              )}
            </Alert>
          )}

          <Button
            variant="primary"
            onClick={handleScore}
            loading={scoring}
            disabled={!canScore}
          >
            {scoring ? 'Scoring...' : score ? 'Rescore Company' : 'Score Company'}
          </Button>
        </Box>

        <Divider />
        
        <Box>
          {showDebug && (
            <>
              <Heading>Debug Information</Heading>
              
              <Text format={{ fontWeight: "bold" }}>Training Counts Response:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(debugInfo?.trainingData?.result || {}, null, 2)}
              </Text>

              <Divider />
              
              <Text format={{ fontWeight: "bold" }}>Companies:</Text>
              <Text format={{ fontFamily: "monospace" }}>
                Ideal: {debugInfo?.trainingData?.result?.companies?.current?.ideal || 0}
                {' '}Required Ideal: {debugInfo?.trainingData?.result?.companies?.required?.ideal || 0}
                {'\n'}
                Less Ideal: {debugInfo?.trainingData?.result?.companies?.current?.less_ideal || 0}
                {' '}Required Less Ideal: {debugInfo?.trainingData?.result?.companies?.required?.less_ideal || 0}
              </Text>

              <Text format={{ fontWeight: "bold" }}>Contacts:</Text>
              <Text format={{ fontFamily: "monospace" }}>
                Ideal: {debugInfo?.trainingData?.result?.contacts?.current?.ideal || 0}
                {' '}Required Ideal: {debugInfo?.trainingData?.result?.contacts?.required?.ideal || 0}
                {'\n'}
                Less Ideal: {debugInfo?.trainingData?.result?.contacts?.current?.less_ideal || 0}
                {' '}Required Less Ideal: {debugInfo?.trainingData?.result?.contacts?.required?.less_ideal || 0}
              </Text>

              <Text format={{ fontWeight: "bold" }}>Deals:</Text>
              <Text format={{ fontFamily: "monospace" }}>
                Ideal: {debugInfo?.trainingData?.result?.deals?.current?.ideal || 0}
                {' '}Required Ideal: {debugInfo?.trainingData?.result?.deals?.required?.ideal || 0}
                {'\n'}
                Less Ideal: {debugInfo?.trainingData?.result?.deals?.current?.less_ideal || 0}
                {' '}Required Less Ideal: {debugInfo?.trainingData?.result?.deals?.required?.less_ideal || 0}
              </Text>

              <Divider />

              <Text format={{ fontWeight: "bold" }}>Context:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify({ portalId: context.portal.id, objectId: context.crm.objectId }, null, 2)}
              </Text>

              <Text format={{ fontWeight: "bold" }}>Score Response:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(debugInfo?.scoreResponse || {}, null, 2)}
              </Text>
            </>
          )}
        </Box>
      </Flex>
    </Box>
  );
};

// Initialize the extension
hubspot.extend(({ context, actions }) => (
  <Extension
    context={context}
    actions={actions}
  />
)); 