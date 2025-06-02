/**
 * @file embeddingTemplates.ts
 * @description Part of NSW Government Jobs ETL Refactoring
 * 
 * Templates and types for embedding generation.
 * These templates maintain the same embedding logic as the current implementation
 * to ensure consistent results during refactoring.
 * 
 * @module services/embeddings/templates
 * @see RefactorETL.md for the complete refactoring plan
 * 
 * @author AWAI Team
 * @version 1.0.0
 * @since 2024-02-06
 */

export interface EmbeddingConfig {
  openaiApiKey: string;
  model: string;
  maxTokens: number;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

export interface EmbeddingResult {
  vector: number[];
  text: string;
  metadata?: {
    source: string;
    timestamp: string;
    model: string;
  };
}

export const jobEmbeddingPrompt = `You are an expert in analyzing job descriptions and generating semantic embeddings.
Your task is to generate a high-quality embedding that captures the key aspects of the job.

Focus on:
1. Core responsibilities and duties
2. Required skills and qualifications
3. Level of seniority and experience
4. Industry and domain context
5. Key technologies and tools

Ensure the embedding:
- Captures both explicit and implicit requirements
- Preserves important contextual information
- Is suitable for semantic similarity matching
- Maintains consistency with other job embeddings`;

export const capabilityEmbeddingPrompt = `You are an expert in analyzing capabilities and generating semantic embeddings.
Your task is to generate a high-quality embedding that captures the essence of the capability.

Focus on:
1. Core competency aspects
2. Required behaviors and skills
3. Level of proficiency
4. Application context
5. Related capabilities

Ensure the embedding:
- Captures both explicit and implicit aspects
- Preserves important behavioral indicators
- Is suitable for capability matching
- Maintains consistency with other capability embeddings`;

export const skillEmbeddingPrompt = `You are an expert in analyzing skills and generating semantic embeddings.
Your task is to generate a high-quality embedding that captures the essence of the skill.

Focus on:
1. Core skill components
2. Required knowledge and experience
3. Level of expertise
4. Application domains
5. Related skills

Ensure the embedding:
- Captures both technical and soft aspects
- Preserves important skill indicators
- Is suitable for skill matching
- Maintains consistency with other skill embeddings`; 