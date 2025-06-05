/**
 * @file types.ts
 * @description Types for the embedding service
 */

export interface EmbeddingResult {
  vector: number[];
  text: string;
  metadata: {
    source: string;
    timestamp: string;
    model: string;
  };
}

export interface EmbeddingConfig {
  model: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
} 