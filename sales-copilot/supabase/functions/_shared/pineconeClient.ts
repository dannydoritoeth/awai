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
      this.logger.info(`Creating vectors with deal metadata for ${documents.length} documents`);
      
      // Create vectors with deal metadata
      const vectors = documents.map((doc, index) => ({
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
      }));
      
      this.logger.info(`Upserting ${vectors.length} vectors to namespace ${namespace}`);
      
      // Sample logging to verify metadata is correct
      if (vectors.length > 0) {
        this.logger.info('First vector metadata sample:', {
          id: vectors[0].id,
          deal_id: vectors[0].metadata.deal_id,
          record_type: vectors[0].metadata.recordType
        });
      }
      
      const result = await this.index.namespace(namespace).upsert(vectors);
      
      // Verify with a fetch of the first vector
      if (vectors.length > 0) {
        const verification = await this.index.namespace(namespace).fetch([vectors[0].id]);
        this.logger.info('Verification result:', {
          found: verification.records.length > 0,
          deal_id: verification.records[0]?.metadata?.deal_id || 'not found'
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error upserting vectors:', error);
      throw error;
    }
  }
  
  /**
   * Query Pinecone index
   */
  async query(namespace: string, vector: number[], filter: any = {}, topK: number = 10): Promise<any> {
    try {
      return await this.index.namespace(namespace).query({
        vector,
        topK,
        filter,
        includeMetadata: true
      });
    } catch (error) {
      this.logger.error('Error querying Pinecone:', error);
      throw error;
    }
  }
  
  /**
   * Delete all vectors in a namespace
   */
  async deleteNamespace(namespace: string): Promise<any> {
    try {
      this.logger.info(`Deleting all vectors in namespace ${namespace}`);
      return await this.index.deleteAll({ namespace });
    } catch (error) {
      // Don't throw if namespace doesn't exist (404)
      if (error.message.includes('404')) {
        this.logger.info(`Namespace ${namespace} does not exist, nothing to delete`);
        return { success: true, message: 'Namespace does not exist' };
      }
      this.logger.error(`Error deleting namespace ${namespace}:`, error);
      throw error;
    }
  }
} 