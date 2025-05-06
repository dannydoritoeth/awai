import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const API_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/text-embedding-005:predict`;
const BEARER_TOKEN = process.env.GOOGLE_BEARER_TOKEN;

console.log('Vertex AI Config:', { PROJECT_ID, LOCATION });

/**
 * Get embeddings for a text using Google's Vertex AI
 * @param {string} text - The text to get embeddings for
 * @returns {Promise<number[]>} The embedding vector
 */
export async function getEmbeddings(text) {
  if (!PROJECT_ID) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  if (!BEARER_TOKEN) {
    throw new Error('GOOGLE_BEARER_TOKEN environment variable is required');
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
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Generate text for embedding from an object's properties
 * @param {Object} obj - The object to generate text from
 * @returns {string} Concatenated text suitable for embedding
 */
export function generateEmbeddingText(obj) {
  return Object.entries(obj)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' ');
} 