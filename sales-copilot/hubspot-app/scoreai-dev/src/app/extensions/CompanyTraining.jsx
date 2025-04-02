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

  // Add validation helper
  const isScoreValid = (score) => {
    if (score === '') return true; // Empty is valid while typing
    const num = Number(score);
    return Number.isInteger(num) && num >= 0 && num <= 100;
  };

  useEffect(() => {
    fetchTrainingData();
  }, []);

  const fetchTrainingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await hubspot.fetch(
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}&action=get`,
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Debug info for validation
      const validationInfo = {
        beforeValidation: {
          value: trainingData.training_score,
          type: typeof trainingData.training_score
        }
      };

      // Validate and prepare data for saving
      const score = Number(trainingData.training_score);
      validationInfo.parsedScore = score;

      if (isNaN(score) || score < 0 || score > 100) {
        throw new Error('Score must be a number between 0 and 100');
      }

      const dataToSave = {
        training_score: score,  // Send as number, not string
        training_attributes: trainingData.training_attributes,
        training_notes: trainingData.training_notes
      };

      setDebugInfo(prev => ({ 
        ...prev, 
        validation: validationInfo,
        dataToSave
      }));

      const response = await hubspot.fetch(
        `${SUPABASE_GET_TRAINING_DETAIL_URL}?portalId=${context.portal.id}&recordType=company&recordId=${context.crm.objectId}&action=update&training_score=${score}&training_attributes=${encodeURIComponent(trainingData.training_attributes.join(','))}&training_notes=${encodeURIComponent(trainingData.training_notes || '')}`,
        {
          method: 'POST'
        }
      );

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        setDebugInfo(prev => ({ 
          ...prev, 
          parseError: {
            message: parseError.message,
            stack: parseError.stack
          }
        }));
        throw new Error('Invalid response from server. Please try again.');
      }

      setDebugInfo(prev => ({ 
        ...prev, 
        saveResponse: data 
      }));

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