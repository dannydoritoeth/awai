import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@5.1.1';
import { Logger } from './logger.ts';

// Define metadata type for better typechecking
export interface PineconeMetadata {
  id: string;
  portalId: string;
  recordType: 'contact' | 'company' | 'deal';
  updatedAt: string;
  deal_id?: string;
  deal_value?: number;
  conversion_days?: number;
  pipeline?: string;
  dealstage?: string;
  days_in_pipeline?: number;
  classification?: string;
  source?: string;
  record_type?: string;
  [key: string]: any; // Allow for other properties
}

export class PineconeClient {
  private index: any;
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger('PineconeClient');
  }

  /**
   * Initialize the Pinecone client and return the index
   */
  async initialize(apiKey: string, indexName: string): Promise<any> {
    this.logger.info('Initializing Pinecone client');
    const pinecone = new Pinecone({
      apiKey
    });
    
    this.index = pinecone.index(indexName);
    return this.index;
  }

  /**
   * Upsert vectors to Pinecone with specific deal metadata
   */
  async upsertVectorsWithDealMetadata(
    namespace: string, 
    documents: any[], 
    embeddings: any[], 
    dealInfo: {
      deal_id: string;
      deal_value: number;
      conversion_days: number;
      pipeline: string;
      dealstage: string;
      days_in_pipeline: number;
    }
  ): Promise<any> {
    try {
      this.logger.info(`Upserting ${documents.length} documents to namespace ${namespace}`);
      
      // Verify we have an initialized index
      if (!this.index) {
        this.logger.error('Pinecone client not initialized');
        throw new Error('Pinecone client not initialized. Call initialize() first.');
      }
      
      // Verify document and embedding counts match
      if (documents.length !== embeddings.length) {
        this.logger.error('Document count doesn\'t match embedding count');
        throw new Error(`Document count (${documents.length}) doesn't match embedding count (${embeddings.length})`);
      }
      
      // Create vectors with deal metadata
      const vectors = documents.map((doc, index) => {
        // Verify embedding exists and is an array
        if (!embeddings[index]?.embedding || !Array.isArray(embeddings[index].embedding)) {
          this.logger.error('Invalid embedding found');
          throw new Error(`Invalid embedding at index ${index}`);
        }
        
        return {
          id: doc.metadata.id.toString(),
          values: Array.from(embeddings[index].embedding),
          metadata: {
            ...doc.metadata,
            // Always add deal metadata to link related records
            deal_id: dealInfo.deal_id,
            deal_value: dealInfo.deal_value,
            conversion_days: dealInfo.conversion_days,
            pipeline: dealInfo.pipeline,
            dealstage: dealInfo.dealstage,
            days_in_pipeline: dealInfo.days_in_pipeline
          }
        };
      });
      
      // Perform the upsert operation
      const result = await this.index.namespace(namespace).upsert(vectors);
      this.logger.info(`Upserted ${vectors.length} vectors to namespace ${namespace}`);
      
      return result;
    } catch (error) {
      this.logger.error('Error upserting vectors:', error.message);
      throw error;
    }
  }
  
  /**
   * Query Pinecone index
   */
  async query(namespace: string, vector: number[] | null, filter: any = {}, topK: number = 10): Promise<any> {
    try {
      this.logger.info(`Querying Pinecone namespace ${namespace} with filter: ${JSON.stringify(filter)}`);
      
      // Special handling for querying by exact ID (not in batch)
      if (!vector && filter && typeof filter === 'string') {
        this.logger.info(`Querying for single ID: ${filter}`);
        return await this.fetchByIds([filter], namespace);
      }
      
      // Special handling for ID-only batch queries
      if (!vector && filter && filter.id) {
        // Handle direct ID match (string)
        if (typeof filter.id === 'string') {
          this.logger.info(`ID-only query for single vector ID: ${filter.id}`);
          return await this.fetchByIds([filter.id], namespace);
        }
        
        // Handle $in operator (array of IDs)
        if (filter.id.$in && Array.isArray(filter.id.$in)) {
          this.logger.info(`ID-only query for ${filter.id.$in.length} vectors in namespace ${namespace}`);
          return await this.fetchByIds(filter.id.$in, namespace);
        }
      }
      
      // If we get here, it's a regular vector query
      const queryParams = {
        vector,
        topK,
        filter,
        includeMetadata: true
      };
      
      const response = await this.index.namespace(namespace).query(queryParams);
      this.logger.info(`Query returned ${response.matches ? response.matches.length : 0} vectors`);
      return response;
    } catch (error) {
      this.logger.error('Error querying Pinecone:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch vectors directly by their IDs using a direct HTTP request
   * @param ids Array of vector IDs to fetch
   * @param namespace Namespace to fetch vectors from
   * @param indexHost The host of the Pinecone index (e.g., "example-index.svc.region.pinecone.io")
   * @param apiKey Pinecone API key
   */
  async fetchByIds(
    ids: string[], 
    namespace: string, 
    indexHost?: string,
    apiKey?: string
  ): Promise<any> {
    try {
      this.logger.info(`Fetching ${ids.length} vectors by ID from namespace ${namespace}`);
      
      // Get API key and host from parameters or try to get from environment
      const host = indexHost || Deno.env.get('PINECONE_INDEX_HOST');
      const key = apiKey || Deno.env.get('PINECONE_API_KEY');
      
      if (!host || !key) {
        this.logger.warn('Missing Pinecone index host or API key. Cannot fetch vectors by ID.');
        return { matches: [] }; // Return empty result instead of throwing
      }
      
      // Fix: Ensure host doesn't already contain https:// to avoid duplication
      const cleanHost = host.replace(/^https?:\/\//, '');
      
      // Build the URL with the repeated ids parameter
      let url = `https://${cleanHost}/vectors/fetch?`;
      
      // Add each ID as a separate query parameter
      ids.forEach(id => {
        url += `ids=${encodeURIComponent(id.toString())}&`;
      });
      
      // Add namespace
      url += `namespace=${encodeURIComponent(namespace)}`;
      
      this.logger.info(`Making direct fetch request to: ${url}`);
      
      // Make the HTTP request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Api-Key': key,
          'X-Pinecone-API-Version': '2025-01',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone fetch request failed: ${response.status} ${response.statusText} ${errorText}`);
      }
      
      const result = await response.json();
      
      // Log the result
      if (result.vectors && Object.keys(result.vectors).length > 0) {
        const foundIds = Object.keys(result.vectors);
        this.logger.info(`Found ${foundIds.length} vectors by ID lookup`);
        
        // Transform to match the format from query for consistency
        const matches = foundIds.map(id => ({
          id,
          metadata: result.vectors[id].metadata,
          score: 1.0 // Default score for direct fetches
        }));
        
        return { matches };
      } else {
        this.logger.info('No vectors found with fetchByIds');
        return { matches: [] };
      }
    } catch (error) {
      this.logger.error(`Error fetching vectors by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all vectors in a namespace
   */
  async deleteNamespace(namespace: string): Promise<any> {
    try {
      this.logger.info(`Deleting namespace ${namespace}`);
      return await this.index.deleteAll({ namespace });
    } catch (error) {
      // Don't throw if namespace doesn't exist (404)
      if (error.message.includes('404')) {
        this.logger.info(`Namespace ${namespace} does not exist, nothing to delete`);
        return { success: true, message: 'Namespace does not exist' };
      }
      this.logger.error(`Error deleting namespace ${namespace}:`, error.message);
      throw error;
    }
  }

  /**
   * Upsert documents with pre-generated embeddings to Pinecone
   * Each document should contain: id, text, metadata, and embedding
   */
  async upsertDocumentsWithEmbeddings(
    documentsWithEmbeddings: {
      id: string;
      text: string;
      metadata: any;
      embedding: number[];
    }[],
    namespace: string
  ): Promise<any> {
    try {
      this.logger.info(`Upserting ${documentsWithEmbeddings.length} documents to namespace ${namespace}`);
      
      // Verify we have an initialized index
      if (!this.index) {
        this.logger.error('Pinecone client not initialized');
        throw new Error('Pinecone client not initialized. Call initialize() first.');
      }
      
      // Create vectors from documents with embedded vectors
      const vectors = documentsWithEmbeddings.map(doc => {
        // Verify embedding exists and is an array
        if (!doc.embedding || !Array.isArray(doc.embedding)) {
          this.logger.error('Invalid embedding found');
          throw new Error(`Invalid embedding for document ${doc.id}`);
        }
        
        return {
          id: doc.id.toString(),
          values: Array.from(doc.embedding),
          metadata: {
            ...doc.metadata,
            text: doc.text.substring(0, 1000) // Truncate text to avoid metadata size limits
          }
        };
      });
      
      // Perform the upsert operation
      const result = await this.index.namespace(namespace).upsert(vectors);
      this.logger.info(`Upserted ${vectors.length} vectors to namespace ${namespace}`);
      
      return result;
    } catch (error) {
      this.logger.error('Error upserting vectors:', error.message);
      throw error;
    }
  }
} 