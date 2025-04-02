import React, { useState, useEffect } from "react";
import {
  Button,
  Text,
  LoadingSpinner,
  Alert,
  Box,
  Input,
  MultiSelect,
  TextArea,
  Flex,
  hubspot,
  Link,
  Divider,
} from "@hubspot/ui-extensions";

// Supabase function URLs
const SUPABASE_GET_TRAINING_DETAIL_URL = 'https://rtalhjaoxlcqmxppuhhz.supabase.co/functions/v1/hubspot-training-detail';

// Training attributes options
const TRAINING_ATTRIBUTES = [
  // Positive attributes
  { label: 'Strong Financials', value: 'strong_financials' },
  { label: 'Growth Stage', value: 'growth_stage' },
  { label: 'Market Leader', value: 'market_leader' },
  { label: 'Strong Leadership', value: 'strong_leadership' },
  { label: 'Innovation Focus', value: 'innovation_focus' },
  { label: 'Global Presence', value: 'global_presence' },
  { label: 'Efficient Processes', value: 'efficient_processes' },
  { label: 'Quality Focus', value: 'quality_focus' },
  // Negative attributes
  { label: 'Financial Instability', value: 'financial_instability' },
  { label: 'Limited Resources', value: 'limited_resources' },
  { label: 'Limited Market Share', value: 'limited_market_share' },
  { label: 'Process Issues', value: 'process_issues' },
  { label: 'Technology Gaps', value: 'tech_gaps' },
  { label: 'Geographic Limitations', value: 'geographic_limitations' }
].sort((a, b) => a.label.localeCompare(b.label));

const Extension = ({ context, actions }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [trainingData, setTrainingData] = useState({
    training_score: '',
    training_attributes: [],
    training_notes: ''
  });
  const [debugInfo, setDebugInfo] = useState({});
  const [trainingCounts, setTrainingCounts] = useState(null);

  // Add URL helper functions
  const getHighScoreUrl = () => {
    if (!context?.portal?.id) return '#';
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/0-2/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22GTE%22%2C%22value%22%3A%2280%22%7D%5D`;
  };

  const getLowScoreUrl = () => {
    if (!context?.portal?.id) return '#';
    return `https://app-na2.hubspot.com/contacts/${context.portal.id}/objects/0-2/views/all/list?filters=%5B%7B%22property%22%3A%22training_score%22%2C%22operator%22%3A%22LT%22%2C%22value%22%3A%2250%22%7D%5D`;
  };

  // Add validation helper
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

  useEffect(() => {
    fetchTrainingData();
    fetchTrainingCounts();
  }, []);

  const fetchTrainingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchWithRetry(
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}&action=get`,
        {
          method: 'POST'
        }
      );

      console.log('Training data response:', data);
      setDebugInfo(prev => ({ ...prev, fetchResponse: data }));

      if (data.success) {
        setTrainingData({
          training_score: data.result.training_score || '',
          training_attributes: data.result.training_attributes ? data.result.training_attributes.split(';') : [],
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
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}&action=counts`,
        {
          method: 'POST'
        }
      );

      if (data.success) {
        setTrainingCounts(data.result.companies);
      }
    } catch (error) {
      console.error('Error fetching training counts:', error);
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
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}&action=update&training_score=${score}&training_attributes=${encodeURIComponent(trainingData.training_attributes.join(','))}&training_notes=${encodeURIComponent(trainingData.training_notes || '')}`,
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
              <Text format={{ fontSize: "md", fontWeight: "bold" }}>More training data needed before companies can be scored</Text>
              <Box margin={{ bottom: "sm" }}>
                <Text>You will need:</Text>
              </Box>
              <Box margin={{ left: "md" }}>
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
              </Box>
              <Divider margin={{ top: "md", bottom: "md" }} />
              <Text>
                Instructions for adding training records can be found <Link href="https://acceleratewith.ai/app-success">here</Link>.
              </Text>
            </Box>
          </Alert>
        )}

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
          <Text format={{ fontWeight: "bold" }}>Training Attributes</Text>
          <MultiSelect
            name="training_attributes"
            label="Select training attributes"
            value={trainingData.training_attributes}
            onChange={(values) => {
              console.log('Selected values:', values);
              setTrainingData(prev => ({
                ...prev,
                training_attributes: values || []
              }));
            }}
            options={TRAINING_ATTRIBUTES}
            error={error}
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

        <Box>
          <Text format={{ fontWeight: "bold" }}>Debug Information</Text>
          <Text format={{ fontFamily: "monospace" }} style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
};

hubspot.extend(({ context, actions }) => (
  <Extension
    context={context}
    actions={actions}
  />
)); 