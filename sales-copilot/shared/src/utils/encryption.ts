import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING = 'base64';

/**
 * Encrypts data using AES-256-GCM
 * @param data - The data to encrypt
 * @param key - The encryption key
 * @returns The encrypted data as a base64 string
 */
export async function encrypt(data: string, key: string): Promise<string> {
  try {
    // Generate a random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, Buffer.from(key), iv);

    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);

    // Get the auth tag
    const tag = cipher.getAuthTag();

    // Combine the salt, IV, encrypted data, and auth tag
    const result = Buffer.concat([
      salt,
      iv,
      Buffer.from(encrypted, ENCODING),
      tag
    ]).toString(ENCODING);

    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts data that was encrypted using the encrypt function
 * @param encryptedData - The encrypted data as a base64 string
 * @param key - The encryption key
 * @returns The decrypted data
 */
export async function decrypt(encryptedData: string, key: string): Promise<string> {
  try {
    // Convert the combined data back to a buffer
    const buffer = Buffer.from(encryptedData, ENCODING);

    // Extract the pieces
    const salt = buffer.slice(0, SALT_LENGTH);
    const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.slice(-TAG_LENGTH);
    const encrypted = buffer.slice(SALT_LENGTH + IV_LENGTH, -TAG_LENGTH).toString(ENCODING);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(key), iv);
    decipher.setAuthTag(tag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
} 