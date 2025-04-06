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
      this.logger.info(`===== PINECONE-1/10 ===== Starting upsert of ${documents.length} documents to namespace ${namespace}`);
      
      // Verify we have an initialized index
      if (!this.index) {
        this.logger.error('***** PINECONE-ERROR ***** Pinecone client not initialized');
        throw new Error('Pinecone client not initialized. Call initialize() first.');
      }
      this.logger.info('===== PINECONE-2/10 ===== Pinecone index is initialized and ready');
      
      // Verify document and embedding counts match
      if (documents.length !== embeddings.length) {
        this.logger.error('***** PINECONE-ERROR ***** Document count doesn\'t match embedding count', {
          docCount: documents.length,
          embeddingCount: embeddings.length
        });
        throw new Error(`Document count (${documents.length}) doesn't match embedding count (${embeddings.length})`);
      }
      this.logger.info('===== PINECONE-3/10 ===== Document and embedding counts match');
      
      // Create vectors with deal metadata
      this.logger.info('===== PINECONE-4/10 ===== Creating vectors with deal metadata');
      const vectors = documents.map((doc, index) => {
        // Verify embedding exists and is an array
        if (!embeddings[index]?.embedding || !Array.isArray(embeddings[index].embedding)) {
          this.logger.error('***** PINECONE-ERROR ***** Invalid embedding found', {
            index,
            embedding: embeddings[index]
          });
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
      
      this.logger.info(`===== PINECONE-5/10 ===== Created ${vectors.length} vectors for upsert`);
      
      // Sample logging to verify metadata is correct
      if (vectors.length > 0) {
        this.logger.info('===== PINECONE-6/10 ===== First vector sample:', {
          id: vectors[0].id,
          metadata_keys: Object.keys(vectors[0].metadata),
          deal_id: vectors[0].metadata.deal_id,
          record_type: vectors[0].metadata.recordType,
          embedding_size: vectors[0].values.length
        });
      }
      
      // Perform the upsert operation
      this.logger.info(`===== PINECONE-7/10 ===== Executing upsert to namespace ${namespace}`);
      const result = await this.index.namespace(namespace).upsert(vectors);
      this.logger.info('===== PINECONE-8/10 ===== Upsert operation completed successfully', result);
      
      // Verify with a fetch of the first vector
      if (vectors.length > 0) {
        this.logger.info(`===== PINECONE-9/10 ===== Verifying upsert by fetching first vector (id: ${vectors[0].id})`);
        try {
          const verification = await this.index.namespace(namespace).fetch([vectors[0].id]);
          if (verification.records && verification.records.length > 0) {
            this.logger.info('===== PINECONE-10/10 ===== Verification successful:', {
              found: true,
              id: vectors[0].id,
              deal_id: verification.records[0]?.metadata?.deal_id,
              metadata_keys: Object.keys(verification.records[0]?.metadata || {})
            });
          } else {
            this.logger.error('***** PINECONE-ERROR ***** Verification failed - vector not found');
          }
        } catch (verifyError) {
          this.logger.error('***** PINECONE-ERROR ***** Error during verification fetch:', verifyError);
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error('***** PINECONE-ERROR ***** Error upserting vectors:', error);
      // Include stack trace for better debugging
      this.logger.error('***** PINECONE-ERROR ***** Stack trace:', error.stack);
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
      this.logger.info(`===== PINECONE ===== Starting upsert of ${documentsWithEmbeddings.length} documents to namespace ${namespace}`);
      
      // Verify we have an initialized index
      if (!this.index) {
        this.logger.error('***** PINECONE-ERROR ***** Pinecone client not initialized');
        throw new Error('Pinecone client not initialized. Call initialize() first.');
      }
      
      // Create vectors from documents with embedded vectors
      const vectors = documentsWithEmbeddings.map(doc => {
        // Verify embedding exists and is an array
        if (!doc.embedding || !Array.isArray(doc.embedding)) {
          this.logger.error('***** PINECONE-ERROR ***** Invalid embedding found', {
            id: doc.id,
            hasEmbedding: !!doc.embedding,
            embeddingType: typeof doc.embedding
          });
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
      
      // Sample logging to verify metadata is correct
      if (vectors.length > 0) {
        const sample = vectors[0];
        this.logger.info('===== PINECONE ===== First vector sample:', {
          id: sample.id,
          metadata_keys: Object.keys(sample.metadata),
          deal_id: sample.metadata.deal_id,
          embedding_size: sample.values.length
        });
      }
      
      // Perform the upsert operation in batches to avoid size limits
      const batchSize = 100;
      let totalUpserted = 0;
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        this.logger.info(`===== PINECONE ===== Upserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vectors.length/batchSize)}: ${batch.length} vectors`);
        
        const result = await this.index.namespace(namespace).upsert(batch);
        totalUpserted += result.upsertedCount;
        
        this.logger.info(`===== PINECONE ===== Batch upsert completed`, {
          batchSize: batch.length,
          upsertedCount: result.upsertedCount,
          totalUpserted
        });
      }
      
      // Verify with a fetch of the first vector
      if (vectors.length > 0) {
        this.logger.info(`===== PINECONE ===== Verifying upsert by fetching first vector (id: ${vectors[0].id})`);
        try {
          const verification = await this.index.namespace(namespace).fetch([vectors[0].id]);
          if (verification.records && verification.records[vectors[0].id]) {
            this.logger.info('===== PINECONE ===== Verification successful:', {
              found: true,
              id: vectors[0].id,
              metadata: verification.records[vectors[0].id]?.metadata,
              metadata_keys: Object.keys(verification.records[vectors[0].id]?.metadata || {})
            });
          } else {
            this.logger.error('***** PINECONE-ERROR ***** Verification failed - vector not found');
          }
        } catch (verifyError) {
          this.logger.error('***** PINECONE-ERROR ***** Error during verification fetch:', verifyError);
        }
      }
      
      return { upsertedCount: totalUpserted };
    } catch (error) {
      this.logger.error('***** PINECONE-ERROR ***** Error upserting vectors:', error);
      // Include stack trace for better debugging
      this.logger.error('***** PINECONE-ERROR ***** Stack trace:', error.stack);
      throw error;
    }
  }
} 