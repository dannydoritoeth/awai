import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PineconeClient } from "../_shared/pineconeClient.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("pinecone-client-test");

/**
 * Create a test document with a random embedding
 */
function createTestDocument(id) {
  return {
    id,
    content: `Test document content ${id}`,
    metadata: {
      id,
      portalId: "123456",
      recordType: "deal",
      updatedAt: new Date().toISOString(),
      source: "test",
      pinecone_updated_at: new Date().toISOString()
    },
    embedding: Array.from({ length: 3072 }, () => Math.random() * 2 - 1)
  };
}

// Sleep function for adding delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a series of tests against the Pinecone client
 */
async function runPineconeTests(apiKey, indexName) {
  const results = {
    tests: [],
    totalTests: 0,
    passed: 0,
    failed: 0
  };

  // Test 1: Initialize client
  logger.info("Test 1: Initialize Pinecone client");
  const pineconeClient = new PineconeClient();
  let testResult = { name: "Initialize Client", success: false, duration: 0, error: "" };
  const testStartTime = Date.now();
  
  try {
    await pineconeClient.initialize(apiKey, indexName);
    testResult.success = true;
    logger.info("✅ Client initialization successful");
  } catch (error) {
    testResult.success = false;
    testResult.error = error.message;
    logger.error(`❌ Client initialization failed: ${error.message}`);
  }
  
  testResult.duration = Date.now() - testStartTime;
  results.tests.push(testResult);
  results.totalTests++;
  results.passed += testResult.success ? 1 : 0;
  results.failed += testResult.success ? 0 : 1;
  
  // If initialization failed, abort further tests
  if (!testResult.success) {
    logger.error("Client initialization failed, aborting tests");
    return results;
  }
  
  // Create a unique test namespace
  const testNamespace = `test-ns-${Date.now()}`;
  logger.info(`Using test namespace: ${testNamespace}`);
  
  // Test 2: Delete namespace (initial cleanup)
  logger.info("Test 2: Delete namespace (initial cleanup)");
  testResult = { name: "Delete Namespace (Initial Cleanup)", success: false, duration: 0, error: "" };
  const deleteStartTime = Date.now();
  
  try {
    await pineconeClient.deleteNamespace(testNamespace);
    testResult.success = true;
    logger.info("✅ Namespace deletion (cleanup) successful");
  } catch (error) {
    // It's okay if the namespace doesn't exist yet
    if (error.message && error.message.includes("404")) {
      testResult.success = true;
      logger.info("✅ Namespace does not exist yet (expected for cleanup)");
    } else {
      testResult.success = false;
      testResult.error = error.message;
      logger.error(`❌ Namespace deletion failed: ${error.message}`);
    }
  }
  
  testResult.duration = Date.now() - deleteStartTime;
  results.tests.push(testResult);
  results.totalTests++;
  results.passed += testResult.success ? 1 : 0;
  results.failed += testResult.success ? 0 : 1;
  
  // Test 3: Upsert documents
  logger.info("Test 3: Upsert documents with embeddings");
  testResult = { name: "Upsert Documents", success: false, duration: 0, error: "" };
  const upsertStartTime = Date.now();
  
  try {
    // Create test documents
    const testDocs = [
      createTestDocument("test-doc-1"),
      createTestDocument("test-doc-2"),
      createTestDocument("test-doc-3")
    ];
    
    // Prepare deal info
    const dealInfo = {
      deal_id: "test-deal-123",
      deal_value: 10000,
      conversion_days: 30,
      pipeline: "test-pipeline",
      dealstage: "closedwon",
      days_in_pipeline: 60
    };
    
    // Upsert the documents
    const upsertResult = await pineconeClient.upsertVectorsWithDealMetadata(
      testNamespace,
      testDocs,
      testDocs.map(doc => ({ embedding: doc.embedding })),
      dealInfo
    );
    
    testResult.success = true;
    logger.info(`✅ Document upsert successful: ${JSON.stringify(upsertResult)}`);
  } catch (error) {
    testResult.success = false;
    testResult.error = error.message;
    logger.error(`❌ Document upsert failed: ${error.message}`);
  }
  
  testResult.duration = Date.now() - upsertStartTime;
  results.tests.push(testResult);
  results.totalTests++;
  results.passed += testResult.success ? 1 : 0;
  results.failed += testResult.success ? 0 : 1;
  
  // Test 4: Query with filter
  logger.info("Test 4: Query with filter");
  testResult = { name: "Query with Filter", success: false, duration: 0, error: "" };
  const queryStartTime = Date.now();
  
  try {
    // Query with a simple filter
    const filter = {
      recordType: "deal"
    };
    
    // Use null for vector to perform a metadata-only query
    const queryResult = await pineconeClient.query(testNamespace, null, filter, 10);
    
    // Check if we got results
    if (queryResult.matches && queryResult.matches.length > 0) {
      testResult.success = true;
      logger.info(`✅ Query successful, found ${queryResult.matches.length} matches`);
    } else {
      testResult.success = false;
      testResult.error = "No matches found in query";
      logger.error("❌ Query returned no matches");
    }
  } catch (error) {
    testResult.success = false;
    testResult.error = error.message;
    logger.error(`❌ Query failed: ${error.message}`);
  }
  
  testResult.duration = Date.now() - queryStartTime;
  results.tests.push(testResult);
  results.totalTests++;
  results.passed += testResult.success ? 1 : 0;
  results.failed += testResult.success ? 0 : 1;
  
  // Test 5: Direct ID fetch
  logger.info("Test 5: Direct ID fetch");
  testResult = { name: "Direct ID Fetch", success: false, duration: 0, error: "" };
  const fetchStartTime = Date.now();
  
  try {
    // Wait for Pinecone to finish indexing (5 seconds)
    logger.info("Waiting for Pinecone to finish indexing vectors (5 second delay)...");
    await sleep(10000);
    
    // Use the direct fetchByIds method
    const ids = ["test-doc-1", "test-doc-2"];
    logger.info(`Fetching vectors directly by IDs: ${JSON.stringify(ids)}`);
    
    // Get Pinecone index host and API key from environment variables
    const pineconeIndexHost = Deno.env.get("PINECONE_INDEX_HOST") || "";
    const pineconeApiKey = Deno.env.get("PINECONE_API_KEY") || "";
    
    if (!pineconeIndexHost || !pineconeApiKey) {
      throw new Error("Required environment variables PINECONE_INDEX_HOST and PINECONE_API_KEY must be set");
    }
    
    logger.info(`Using Pinecone index host: ${pineconeIndexHost}`);
    
    // Pass the index host and API key to the fetchByIds method
    const fetchResult = await pineconeClient.fetchByIds(
      ids, 
      testNamespace,
      pineconeIndexHost,
      pineconeApiKey
    );
    
    // Check if we got results
    if (fetchResult.matches && fetchResult.matches.length > 0) {
      testResult.success = true;
      logger.info(`✅ Direct ID fetch successful, found ${fetchResult.matches.length} matches`);
      
      // Log the IDs we found
      const foundIds = fetchResult.matches.map(match => match.id);
      logger.info(`Found IDs: ${JSON.stringify(foundIds)}`);
    } else {
      testResult.success = false;
      testResult.error = "No matches found in direct ID fetch";
      logger.error("❌ Direct ID fetch returned no matches");
    }
  } catch (error) {
    testResult.success = false;
    testResult.error = error.message;
    logger.error(`❌ Direct ID fetch failed: ${error.message}`);
  }
  
  testResult.duration = Date.now() - fetchStartTime;
  results.tests.push(testResult);
  results.totalTests++;
  results.passed += testResult.success ? 1 : 0;
  results.failed += testResult.success ? 0 : 1;
  
  // Test 6: Delete namespace (final cleanup)
  logger.info("Test 6: Delete namespace (final cleanup)");
  testResult = { name: "Delete Namespace (Final Cleanup)", success: false, duration: 0, error: "" };
  const finalDeleteStartTime = Date.now();
  
  try {
    await pineconeClient.deleteNamespace(testNamespace);
    testResult.success = true;
    logger.info("✅ Namespace deletion successful");
  } catch (error) {
    testResult.success = false;
    testResult.error = error.message;
    logger.error(`❌ Namespace deletion failed: ${error.message}`);
  }
  
  testResult.duration = Date.now() - finalDeleteStartTime;
  results.tests.push(testResult);
  results.totalTests++;
  results.passed += testResult.success ? 1 : 0;
  results.failed += testResult.success ? 0 : 1;
  
  // Log summary
  logger.info(`Tests completed: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

serve(async (req) => {
  try {
    logger.info("Pinecone client test function started");
    
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    // Validate request method
    if (req.method !== "POST" && req.method !== "GET") {
      throw new Error(`Method ${req.method} not allowed. Only GET and POST requests are accepted.`);
    }

    // Get environment variables
    const pineconeApiKey = Deno.env.get("PINECONE_API_KEY") || "";
    const pineconeIndex = Deno.env.get("PINECONE_INDEX") || "";
    
    if (!pineconeApiKey || !pineconeIndex) {
      throw new Error("Pinecone API key or index name not found in environment variables");
    }

    // Run tests
    const testResults = await runPineconeTests(pineconeApiKey, pineconeIndex);

    // Return the response
    return new Response(
      JSON.stringify({
        success: testResults.failed === 0,
        message: `Pinecone client tests: ${testResults.passed} passed, ${testResults.failed} failed`,
        results: testResults
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 200
      }
    );
  } catch (error) {
    logger.error("Error in pinecone-client-test:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 500
      }
    );
  }
}); 