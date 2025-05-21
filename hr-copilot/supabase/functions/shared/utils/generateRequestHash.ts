import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

/**
 * Generates a deterministic hash for a request object
 * This ensures identical requests get the same hash
 */
export function generateRequestHash(request: Record<string, any>): Uint8Array {
  // Extract relevant fields for hashing
  const hashableContent = {
    mode: request.mode,
    profileId: request.profileId,
    roleId: request.roleId,
    action: request.action,
    // Include only fields that affect the result
    // Exclude fields like sessionId, timestamp, etc.
    context: {
      ...(request.context || {}),
      // Remove dynamic fields from context
      lastMessage: undefined,
      timestamp: undefined,
      sessionId: undefined,
      embeddedMessage: undefined,
      contextEmbedding: undefined
    }
  };

  // Sort object keys for consistent ordering
  const ordered = Object.keys(hashableContent)
    .sort()
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = hashableContent[key];
      return acc;
    }, {});

  // Convert to string and hash
  const msgUint8 = new TextEncoder().encode(JSON.stringify(ordered));
  const hashBuffer = crypto.subtle.digestSync("SHA-256", msgUint8);
  return new Uint8Array(hashBuffer);
} 