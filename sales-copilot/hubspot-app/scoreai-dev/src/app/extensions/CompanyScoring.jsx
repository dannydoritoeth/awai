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
      setDebugInfo(prev => ({ ...prev, trainingData: data }));

      if (data.success) {
        const { ideal_companies, less_ideal_companies } = data.result;
        setTrainingCounts({ 
          high: ideal_companies || 0, 
          low: less_ideal_companies || 0 
        });
        setCanScore(ideal_companies >= REQUIRED_TRAINING_COUNT && less_ideal_companies >= REQUIRED_TRAINING_COUNT);

        // Get current score if available
        if (data.result.current_score) {
          setScore(data.result.current_score);
          setSummary(data.result.current_summary || '');
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


      const response = await hubspot.fetch(SUPABASE_SCORE_RECORD_URL, {
        method: 'POST',
        // headers: {
        //   'Content-Type': 'application/json',
        //   'Authorization': `Bearer ${accessToken}`
        // },
        body: JSON.stringify({
          recordId: context.crm.objectId,
          recordType: 'company',
          portalId: context.portal.id
        })
      });

      const data = await response.json();
      setDebugInfo(prev => ({ ...prev, scoreResponse: data }));

      if (data.success) {
        if (data.result.canScore) {
          setScore(data.result.score);
          setSummary(data.result.summary);
          await checkCanScore(); // Refresh training counts and current score
        } else {
          setTrainingError({
            current: data.result.current,
            required: data.result.required
          });
        }
      } else {
        setTrainingError({
          message: data.error || 'Unable to score at this time. Please try again.'
        });
      }
    } catch (error) {
      setTrainingError({
        message: 'Unable to score at this time. Please try again.'
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
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/0-2/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22LT%22%2C%22value%22%3A%2280%22%7D%5D`;
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
            <Alert title="More training data needed" variant="warning">
              {trainingError.message ? (
                <Text>{trainingError.message}</Text>
              ) : (
                <>
                  <Text>
                    You will need at least {trainingError.required.companies} training records with scores above 80 and {trainingError.required.companies} training records with scores below 50.
                  </Text>
                  <Text>
                    You currently have <Link href={getHighScoreUrl()}>{trainingError.current.ideal_companies} high scores</Link> and <Link href={getLowScoreUrl()}>{trainingError.current.less_ideal_companies} low scores</Link>.
                  </Text>
                  <Divider />
                  <Text>
                    Instructions for adding training records can be found <Link href="https://acceleratewith.ai/app-success">here</Link>.
                  </Text>
                </>
              )}
            </Alert>
          )}

          <Button
            variant="primary"
            onClick={handleScore}
            loading={scoring}
          >
            {scoring ? 'Scoring...' : 'Score Company'}
          </Button>
        </Box>

        <Divider />
        
        <Box>
          <Heading>Debug Information</Heading>
          
          <Text format={{ fontWeight: "bold" }}>Training Counts Response:</Text>
          <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(debugInfo?.trainingData?.result || {}, null, 2)}
          </Text>

          <Divider />
          
          <Text format={{ fontWeight: "bold" }}>Companies:</Text>
          <Text format={{ fontFamily: "monospace" }}>
            Ideal: {debugInfo?.trainingData?.result?.companies?.current?.ideal || 0}
            Less Ideal: {debugInfo?.trainingData?.result?.companies?.current?.less_ideal || 0}
          </Text>

          <Text format={{ fontWeight: "bold" }}>Contacts:</Text>
          <Text format={{ fontFamily: "monospace" }}>
            Ideal: {debugInfo?.trainingData?.result?.contacts?.current?.ideal || 0}
            Less Ideal: {debugInfo?.trainingData?.result?.contacts?.current?.less_ideal || 0}
          </Text>

          <Text format={{ fontWeight: "bold" }}>Deals:</Text>
          <Text format={{ fontFamily: "monospace" }}>
            Ideal: {debugInfo?.trainingData?.result?.deals?.current?.ideal || 0}
            Less Ideal: {debugInfo?.trainingData?.result?.deals?.current?.less_ideal || 0}
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