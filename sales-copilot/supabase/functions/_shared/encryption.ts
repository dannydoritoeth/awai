import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { crypto } from 'https://deno.land/std/crypto/mod.ts';

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param data - The data to encrypt
 * @param key - The encryption key (must be 32 bytes for AES-256)
 * @returns Base64 encoded encrypted data with IV and auth tag
 */
export async function encrypt(data: string, key: string): Promise<string> {
  // Convert key to correct format
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const dataBuffer = encoder.encode(data);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + new Uint8Array(encryptedBuffer).length);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  // Return as base64
  return encodeBase64(combined);
}

/**
 * Decrypts data that was encrypted using the encrypt function
 * @param encryptedData - Base64 encoded encrypted data with IV
 * @param key - The encryption key (must be 32 bytes for AES-256)
 * @returns Decrypted data as string
 */
export async function decrypt(encryptedData: string, key: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  // Convert key to correct format
  const keyBuffer = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decode base64 and split IV and data
  const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const encryptedBuffer = combined.slice(12);

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedBuffer
  );

  return decoder.decode(decryptedBuffer);
} 