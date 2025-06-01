import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Load environment variables
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

// Google Vertex AI Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const API_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/text-embedding-005:predict`;
const BEARER_TOKEN = process.env.GOOGLE_BEARER_TOKEN;

// OpenAI Configuration
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'google';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Initialize OpenAI client if using OpenAI
const openai = EMBEDDING_PROVIDER === 'openai' ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

console.log('Embedding Config:', { 
  provider: EMBEDDING_PROVIDER,
  ...(EMBEDDING_PROVIDER === 'google' ? { PROJECT_ID, LOCATION } : {})
});

/**
 * Get embeddings for a text using either Google's Vertex AI or OpenAI
 * @param {string} text - The text to get embeddings for
 * @returns {Promise<number[]>} The embedding vector
 */
export async function getEmbeddings(text) {
  if (EMBEDDING_PROVIDER === 'openai') {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required when using OpenAI embeddings');
    }

    try {
      const response = await openai.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating OpenAI embeddings:', error);
      throw error;
    }
  } else {
    // Google Vertex AI
    if (!PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required when using Google embeddings');
    }

    if (!BEARER_TOKEN) {
      throw new Error('GOOGLE_BEARER_TOKEN environment variable is required when using Google embeddings');
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              task_type: 'SEMANTIC_SIMILARITY',
              content: text
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorData}`);
      }

      const data = await response.json();
      return data.predictions[0].embeddings.values;
    } catch (error) {
      console.error('Error generating Google embeddings:', error);
      throw error;
    }
  }
}

/**
 * Generate text for embedding from an object's properties
 * @param {Object} obj - The object to generate text from
 * @param {string} [type] - Optional type of object for context
 * @returns {string} Concatenated text suitable for embedding
 */
export function generateEmbeddingText(obj, type = '') {
  const prefix = type ? `${type}: ` : '';
  const text = Object.entries(obj)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(', ')}`;
      }
      return `${key}: ${value}`;
    })
    .join(' ');
  return prefix + text;
} 