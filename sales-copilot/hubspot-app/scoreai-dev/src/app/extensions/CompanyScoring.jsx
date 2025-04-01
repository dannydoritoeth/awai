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

// Main Extension Component
const Extension = ({ context, actions }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [summary, setSummary] = useState(null);
  const [canScore, setCanScore] = useState(false);
  const [trainingCounts, setTrainingCounts] = useState({ high: 0, low: 0 });
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    checkCanScore();
  }, []);

  const checkCanScore = async () => {
    try {
      console.log('Starting checkCanScore with context:', context);
      setLoading(true);
      setError(null);

      // Get high score count (>= 80)
      const highScoreResponse = await hubspot.crm.records.searchCompanies({
        filterGroups: [{
          filters: [{
            propertyName: 'training_score',
            operator: 'GTE',
            value: '80'
          }]
        }],
        limit: REQUIRED_TRAINING_COUNT,
        properties: ['training_score']
      });

      // Get low score count (<= 50)
      const lowScoreResponse = await hubspot.crm.records.searchCompanies({
        filterGroups: [{
          filters: [{
            propertyName: 'training_score',
            operator: 'LTE',
            value: '50'
          }]
        }],
        limit: REQUIRED_TRAINING_COUNT,
        properties: ['training_score']
      });

      const highCount = highScoreResponse.total;
      const lowCount = lowScoreResponse.total;
      
      setTrainingCounts({ high: highCount, low: lowCount });
      setCanScore(highCount >= REQUIRED_TRAINING_COUNT && lowCount >= REQUIRED_TRAINING_COUNT);

      // Get current record's score
      const currentRecord = await hubspot.crm.records.get('companies', context.object.objectId);
      
      if (currentRecord.properties.ai_score) {
        setScore(currentRecord.properties.ai_score);
        setSummary(currentRecord.properties.ai_summary || '');
      }
    } catch (error) {
      console.error('Error in checkCanScore:', error);
      setError('Failed to check scoring status');
    } finally {
      setLoading(false);
    }
  };

  const handleScore = async () => {
    try {
      setScoring(true);
      setError(null);

      const response = await hubspot.api.scoreCompany({
        recordId: context.object.objectId,
        recordType: 'company',
        portalId: context.portal.id
      });
      
      const data = await response.json();

      if (data.success) {
        setScore(data.result.score);
        setSummary(data.result.summary);
      } else {
        throw new Error(data.error || 'Scoring failed');
      }
    } catch (error) {
      console.error('Error scoring company:', error);
      setError('Failed to score company');
    } finally {
      setScoring(false);
      checkCanScore();
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
          {!canScore && (
            <Alert title="More training data needed" variant="warning">
              <Text>
                You will need at least {REQUIRED_TRAINING_COUNT} training records with scores above 80 and {REQUIRED_TRAINING_COUNT} training records with scores below 50.
              </Text>
              <Text>
                You currently have <Link href={getHighScoreUrl()}>{trainingCounts.high} high scores</Link> and <Link href={getLowScoreUrl()}>{trainingCounts.low} low scores</Link>.
              </Text>
              <Divider />
              <Text>
                Instructions for adding training records can be found <Link href="https://acceleratewith.ai/app-success">here</Link>.
              </Text>
            </Alert>
          )}

          <Button
            variant="primary"
            disabled={!canScore || scoring}
            onClick={handleScore}
            loading={scoring}
          >
            {scoring ? 'Scoring...' : 'Score Company'}
          </Button>
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