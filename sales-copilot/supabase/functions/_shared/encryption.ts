import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const ALGORITHM = 'AES-256-CBC';
const IV_LENGTH = 16;

/**
 * Encrypts data using AES-256-CBC
 * @param text - The data to encrypt
 * @param key - The encryption key
 * @returns The encrypted data as a base64 string
 */
export async function encrypt(text: string, key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const keyBuffer = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    keyBuffer,
    new TextEncoder().encode(text)
  );

  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  return encodeBase64(combined);
}

/**
 * Decrypts data that was encrypted using the encrypt function
 * @param encryptedText - The encrypted data as a base64 string
 * @param key - The encryption key
 * @returns The decrypted data
 */
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  try {
    if (!encryptedText || !key) {
      throw new Error('Missing required parameters for decryption');
    }

    const combined = decodeBase64(encryptedText);
    if (!combined || combined.length < IV_LENGTH) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const keyBuffer = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "AES-CBC", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      keyBuffer,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw new Error('Decryption failed with unknown error');
  }
} 