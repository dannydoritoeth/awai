import React, { useState, useEffect } from "react";
import {
  Button,
  Text,
  LoadingSpinner,
  Alert,
  Box,
  Input,
  TextArea,
  Flex,
  hubspot,
  Link,
  Divider,
} from "@hubspot/ui-extensions";

// Supabase function URLs
const SUPABASE_GET_TRAINING_DETAIL_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-training-detail';

const BaseTraining = ({ 
  context, 
  actions,
  recordType,
  title = "ScoreAI Training",
  description = "AI-powered training",
  objectTypeId = "0-2", // Default to company, can be overridden
  customTrainingLinks = null, // Optional custom component for training links
  customTrainingForm = null, // Optional custom component for training form
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [trainingData, setTrainingData] = useState({
    training_score: '',
    training_notes: ''
  });
  const [debugInfo, setDebugInfo] = useState({});
  const [trainingCounts, setTrainingCounts] = useState(null);

  // URL helper functions
  const getHighScoreUrl = () => {
    if (!context?.portal?.id) return '#';
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/${objectTypeId}/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22GTE%22%2C%22value%22%3A%2280%22%7D%5D`;
  };

  const getLowScoreUrl = () => {
    if (!context?.portal?.id) return '#';
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/${objectTypeId}/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22LT%22%2C%22value%22%3A%2250%22%7D%5D`;
  };

  // Validation helper
  const isScoreValid = (score) => {
    if (score === '') return true; // Empty is valid while typing
    const num = Number(score);
    return Number.isInteger(num) && num >= 0 && num <= 100;
  };

  const fetchWithRetry = async (url, options) => {
    try {
      const response = await hubspot.fetch(url, options);
      const data = await response.json();
      
      // If successful, return the data
      if (data.success !== false) {
        return data;
      }

      // Check if it's a token expiration error
      if (data.error?.includes('OAuth token') && data.error?.includes('expired')) {
        // Token expired, get a fresh token and retry the request
        await hubspot.refreshToken();
        const retryResponse = await hubspot.fetch(url, options);
        return retryResponse.json();
      }

      // Some other error occurred
      throw new Error(data.error || 'Request failed');
    } catch (error) {
      throw error;
    }
  };

  const getPlural = (recordType) => {
    if (recordType === 'company') return 'companies';
    if (recordType === 'contact') return 'contacts';
    if (recordType === 'deal') return 'deals';
    return `${recordType}s`; // fallback
  };

  useEffect(() => {
    fetchTrainingData();
    fetchTrainingCounts();
  }, []);

  const fetchTrainingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchWithRetry(
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=${recordType}&recordId=${context.crm.objectId}&action=get`,
        {
          method: 'POST'
        }
      );

      console.log('Training data response:', data);
      setDebugInfo(prev => ({ ...prev, fetchResponse: data }));

      if (data.success) {
        setTrainingData({
          training_score: data.result.training_score || '',
          training_notes: data.result.training_notes || ''
        });
      } else {
        throw new Error(data.error || 'Failed to fetch training data');
      }
    } catch (error) {
      console.error('Error fetching training data:', error);
      setError(error.message || 'Failed to fetch training data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainingCounts = async () => {
    try {
      const data = await fetchWithRetry(
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=${recordType}&recordId=${context.crm.objectId}&action=counts`,
        {
          method: 'POST'
        }
      );

      if (data.success) {
        const pluralType = getPlural(recordType);
        const counts = data.result[pluralType];
        
        // Validate the counts data structure
        if (!counts || !counts.current || !counts.required) {
          throw new Error(`Invalid training counts data received for ${recordType}`);
        }

        setTrainingCounts(counts);
        
        // Set debug info
        setDebugInfo(prev => ({
          ...prev,
          trainingCountsResponse: data,
          pluralType,
          counts
        }));
      } else {
        throw new Error(data.error || `Failed to fetch training counts for ${recordType}`);
      }
    } catch (error) {
      console.error('Error fetching training counts:', error);
      setError(`Failed to fetch training counts: ${error.message}`);
      setDebugInfo(prev => ({
        ...prev,
        trainingCountsError: error.message,
        trainingCountsErrorStack: error.stack
      }));
      // Set a safe default for training counts
      setTrainingCounts({
        current: { ideal: 0, less_ideal: 0 },
        required: { ideal: 0, less_ideal: 0 }
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate and prepare data for saving
      const score = Number(trainingData.training_score);
      if (isNaN(score) || score < 0 || score > 100) {
        throw new Error('Score must be a number between 0 and 100');
      }

      const data = await fetchWithRetry(
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=${recordType}&recordId=${context.crm.objectId}&action=update&training_score=${score}&training_notes=${encodeURIComponent(trainingData.training_notes || '')}`,
        {
          method: 'POST'
        }
      );

      setDebugInfo(prev => ({ ...prev, saveResponse: data }));

      if (!data.success) {
        throw new Error(data.error || 'Failed to save training data');
      }

      // Refresh data after successful save
      await fetchTrainingData();
      await fetchTrainingCounts();
    } catch (error) {
      console.error('Error saving training data:', error);
      setError(error.message || 'Failed to save training data');
      setDebugInfo(prev => ({ 
        ...prev, 
        saveError: {
          message: error.message,
          stack: error.stack
        }
      }));
    } finally {
      setSaving(false);
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

        {trainingCounts && (
          trainingCounts.current.ideal < trainingCounts.required.ideal || 
          trainingCounts.current.less_ideal < trainingCounts.required.less_ideal
        ) && (
          <Alert variant="warning">
            <Box>
              <Text format={{ fontSize: "md", fontWeight: "bold" }}>More training data needed before {recordType}s can be scored</Text>
              <Box margin={{ bottom: "sm" }}>
                <Text>You will need:</Text>
              </Box>
              <Box margin={{ left: "md" }}>
                {customTrainingLinks ? (
                  customTrainingLinks({ trainingCounts, getHighScoreUrl, getLowScoreUrl })
                ) : (
                  <>
                    <Box margin={{ bottom: "xs" }}>
                      <Text>
                        • At least {trainingCounts.required.ideal} records with scores above 80
                        {' '}
                        (you currently have <Link href={getHighScoreUrl()}>{trainingCounts.current.ideal} high scores</Link>)
                      </Text>
                    </Box>
                    <Box margin={{ bottom: "sm" }}>
                      <Text>
                        • At least {trainingCounts.required.less_ideal} records with scores below 50
                        {' '}
                        (you currently have <Link href={getLowScoreUrl()}>{trainingCounts.current.less_ideal} low scores</Link>)
                      </Text>
                    </Box>
                  </>
                )}
              </Box>
              <Divider margin={{ top: "md", bottom: "md" }} />
              <Text>
                Instructions for adding training records can be found <Link href="https://acceleratewith.ai/app-success">here</Link>.
              </Text>
            </Box>
          </Alert>
        )}

        {customTrainingForm ? (
          customTrainingForm({
            trainingData,
            setTrainingData,
            handleSave,
            saving,
            isScoreValid
          })
        ) : (
          <>
            <Box>
              <Text format={{ fontWeight: "bold" }}>Training Score (0-100)</Text>
              <Input
                name="training_score"
                value={trainingData.training_score}
                onChange={(value) => {
                  if (value === '') {
                    setTrainingData(prev => ({ ...prev, training_score: '' }));
                  } else {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num >= 0 && num <= 100) {
                      setTrainingData(prev => ({ ...prev, training_score: num.toString() }));
                    }
                  }
                }}
                type="number"
                min="0"
                max="100"
                validationState={
                  trainingData.training_score === '' ? "error" :
                  isScoreValid(trainingData.training_score) ? "success" : "error"
                }
                validationMessage={
                  trainingData.training_score === '' ? "Score is required" :
                  !isScoreValid(trainingData.training_score) ? "Please enter a whole number between 0 and 100" : undefined
                }
                required
              />
            </Box>

            <Box>
              <Text format={{ fontWeight: "bold" }}>Training Notes</Text>
              <TextArea
                value={trainingData.training_notes}
                onChange={(value) => setTrainingData(prev => ({ ...prev, training_notes: value }))}
                rows={4}
              />
            </Box>

            <Box>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!isScoreValid(trainingData.training_score) || trainingData.training_score === ''}
              >
                {saving ? 'Saving...' : 'Save Training Data'}
              </Button>
            </Box>
          </>
        )}

        {showDebug && (
          <>
            <Divider />
            
            <Box>
              <Text format={{ fontWeight: "bold" }}>Debug Information</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(debugInfo, null, 2)}
              </Text>

              <Divider />
              
              <Text format={{ fontWeight: "bold" }}>Training Data:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(trainingData, null, 2)}
              </Text>

              <Divider />

              <Text format={{ fontWeight: "bold" }}>Training Counts:</Text>
              <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(trainingCounts, null, 2)}
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

export default BaseTraining; 