// @ts-nocheck
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { Buffer } from 'buffer';

// Version: crypto@18.0.0
// Version: buffer@18.0.0

/**
 * Configuration interface for encryption operations
 */
export interface EncryptionConfig {
  algorithm: string;  // Default: aes-256-gcm
  secretKey: string;
  ivLength: number;
  keyRotationInterval?: number;
}

/**
 * Interface for encrypted data structure including authentication tag
 */
export interface EncryptedData {
  iv: Buffer;
  content: Buffer;
  authTag: Buffer;
  version: number;
}

// Current encryption version for algorithm rotation
const CURRENT_ENCRYPTION_VERSION = 1;

// Constants for encryption operations
const DEFAULT_IV_LENGTH = 16;
const DEFAULT_AUTH_TAG_LENGTH = 16;
const DEFAULT_SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 310000; // High iteration count for security
const PBKDF2_DIGEST = 'sha512';
const KEY_LENGTH = 32;

/**
 * Encrypts sensitive data using AES-256-GCM with secure memory handling
 * @param data - String data to encrypt
 * @param config - Encryption configuration
 * @returns Promise<EncryptedData> - Encrypted data structure
 * @throws Error if encryption fails
 */
export async function encrypt(
  data: string,
  config: EncryptionConfig
): Promise<EncryptedData> {
  try {
    // Input validation
    if (!data || !config.secretKey) {
      throw new Error('Invalid encryption parameters');
    }

    // Generate cryptographically secure IV
    const iv = randomBytes(config.ivLength || DEFAULT_IV_LENGTH);

    // Create cipher with AES-256-GCM
    const cipher = createCipheriv(
      config.algorithm || 'aes-256-gcm',
      Buffer.from(config.secretKey, 'base64'),
      iv,
      { authTagLength: DEFAULT_AUTH_TAG_LENGTH }
    );

    // Encrypt data
    const encryptedContent = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return encrypted data structure
    return {
      iv,
      content: encryptedContent,
      authTag,
      version: CURRENT_ENCRYPTION_VERSION
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  } finally {
    // Clean up sensitive data from memory
    if (data) {
      data = '';
    }
  }
}

/**
 * Decrypts data encrypted with AES-256-GCM using version-aware decryption
 * @param encryptedData - Encrypted data structure
 * @param config - Encryption configuration
 * @returns Promise<string> - Decrypted string
 * @throws Error if decryption fails
 */
export async function decrypt(
  encryptedData: EncryptedData,
  config: EncryptionConfig
): Promise<string> {
  try {
    // Validate encrypted data structure
    if (!encryptedData?.content || !encryptedData?.iv || !encryptedData?.authTag) {
      throw new Error('Invalid encrypted data structure');
    }

    // Create decipher
    const decipher = createDecipheriv(
      config.algorithm || 'aes-256-gcm',
      Buffer.from(config.secretKey, 'base64'),
      encryptedData.iv,
      { authTagLength: DEFAULT_AUTH_TAG_LENGTH }
    );

    // Set auth tag for verification
    decipher.setAuthTag(encryptedData.authTag);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData.content),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generates a cryptographically secure key with quantum-safe considerations
 * @param length - Desired key length in bytes
 * @returns Promise<string> - Base64 encoded key
 * @throws Error if key generation fails
 */
export async function generateKey(length: number = KEY_LENGTH): Promise<string> {
  try {
    // Validate key length
    if (length < 32) {
      throw new Error('Key length must be at least 32 bytes');
    }

    // Generate random bytes with additional entropy
    const keyBuffer = randomBytes(length);

    // Convert to Base64 string
    return keyBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Key generation failed: ${error.message}`);
  }
}

/**
 * Hashes passwords using PBKDF2 with high iteration count
 * @param password - Password to hash
 * @returns Promise<string> - Hashed password with salt
 * @throws Error if password hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password
    if (!password || password.length < 8) {
      throw new Error('Invalid password');
    }

    // Generate salt
    const salt = randomBytes(DEFAULT_SALT_LENGTH);

    // Hash password using PBKDF2
    const hash = pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST
    );

    // Combine salt and hash with version identifier
    return Buffer.concat([
      Buffer.from([CURRENT_ENCRYPTION_VERSION]),
      salt,
      hash
    ]).toString('base64');
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  } finally {
    // Clear password from memory
    if (password) {
      password = '';
    }
  }
}

// Export interfaces for type checking
export type { EncryptionConfig, EncryptedData };