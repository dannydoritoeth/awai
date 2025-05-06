import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'textembedding-gecko-multilingual-002';

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION
});

/**
 * Get embeddings for a text using Google's Vertex AI
 * @param {string} text - The text to get embeddings for
 * @returns {Promise<number[]>} The embedding vector
 */
export async function getEmbeddings(text) {
  if (!PROJECT_ID) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  try {
    const model = vertexAI.preview.getModel(EMBEDDING_MODEL);
    const result = await model.predict({
      instances: [{ content: text }]
    });

    return result.predictions[0].embeddings.values;
  } catch (error) {
    console.error('Error getting embeddings:', error);
    throw error;
  }
}

/**
 * Generate a text representation for embedding generation
 * @param {Object} entity - The entity object (Role, Job, etc.)
 * @param {string} type - The type of entity ('role', 'job', etc.)
 * @returns {string} Concatenated text for embedding
 */
export function generateEmbeddingText(entity, type) {
  const texts = [];

  switch (type.toLowerCase()) {
    case 'role':
      texts.push(
        entity.title,
        entity.primary_purpose,
        entity.reporting_line,
        entity.direct_reports,
        entity.budget_responsibility
      );
      
      // Add capabilities and skills if available in raw_json
      if (entity.raw_json?.details?.documents) {
        entity.raw_json.details.documents.forEach(doc => {
          if (doc.structuredData) {
            if (doc.structuredData.focusCapabilities) {
              texts.push(...doc.structuredData.focusCapabilities);
            }
            if (doc.structuredData.complementaryCapabilities) {
              texts.push(...doc.structuredData.complementaryCapabilities);
            }
            if (doc.structuredData.skills) {
              texts.push(...doc.structuredData.skills);
            }
          }
        });
      }
      break;

    case 'job':
      texts.push(
        entity.title,
        entity.department,
        entity.job_type,
        ...entity.locations,
        entity.remuneration
      );
      break;

    case 'skill':
      texts.push(
        entity.name,
        entity.description,
        entity.category
      );
      break;

    default:
      throw new Error(`Unsupported entity type: ${type}`);
  }

  // Filter out nulls and empty strings, then join with spaces
  return texts.filter(text => text).join(' ');
} 