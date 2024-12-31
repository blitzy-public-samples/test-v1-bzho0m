/**
 * @fileoverview Implements secure guest preference model with validation and encryption
 * for the hotel management system, handling sensitive guest preference data.
 * @version 1.0.0
 */

// External imports
import { PrismaClient } from '@prisma/client'; // v5.0.0
import * as crypto from 'crypto';
import { z } from 'zod'; // v3.21.4
import { UUID } from 'crypto';

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';

// Constants for encryption
const ENCRYPTION_KEY = process.env.PREFERENCE_ENCRYPTION_KEY || '';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Validation schemas for preference data
 */
const roomTypeEnum = z.enum(['STANDARD', 'DELUXE', 'SUITE', 'ACCESSIBLE']);
const bedTypeEnum = z.enum(['SINGLE', 'DOUBLE', 'QUEEN', 'KING']);
const pillowTypeEnum = z.enum(['SOFT', 'MEDIUM', 'FIRM', 'HYPOALLERGENIC']);
const temperatureRange = z.number().min(18).max(28);

/**
 * Interface defining the structure of guest preferences with validation
 */
export interface Preference extends BaseModel {
  guestId: UUID;
  roomType: string;
  floorLevel: number;
  smokingRoom: boolean;
  bedType: string[];
  pillowType: string[];
  amenities: string[];
  dietaryRestrictions: string;
  temperature: string;
  specialRequests: any;
  accessibilityNeeds: string;
  communicationPreferences: any;
}

/**
 * Zod schema for preference validation
 */
const preferenceSchema = z.object({
  guestId: z.string().uuid(),
  roomType: roomTypeEnum,
  floorLevel: z.number().min(1).max(50),
  smokingRoom: z.boolean(),
  bedType: z.array(bedTypeEnum),
  pillowType: z.array(pillowTypeEnum),
  amenities: z.array(z.string()),
  dietaryRestrictions: z.string(),
  temperature: temperatureRange,
  specialRequests: z.record(z.any()),
  accessibilityNeeds: z.string(),
  communicationPreferences: z.record(z.any())
});

/**
 * Implements secure guest preference model with encryption and validation
 */
export class PreferenceModel {
  private prisma: PrismaClient;
  private encryptionHandler: crypto.Cipher;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      connectionTimeout: 5000
    });
    this.initializeEncryption();
  }

  /**
   * Initializes encryption handler with secure key management
   */
  private initializeEncryption(): void {
    if (!ENCRYPTION_KEY) {
      throw new Error('Encryption key not configured');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    this.encryptionHandler = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
  }

  /**
   * Encrypts sensitive preference data
   */
  private encryptField(data: string): string {
    const encrypted = this.encryptionHandler.update(data, 'utf8', 'hex');
    return encrypted + this.encryptionHandler.final('hex');
  }

  /**
   * Decrypts sensitive preference data
   */
  private decryptField(encryptedData: string): string {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      this.encryptionHandler.getAuthTag()
    );
    const decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    return decrypted + decipher.final('utf8');
  }

  /**
   * Creates a new preference record with validation and encryption
   */
  async create(data: Preference): Promise<Preference> {
    try {
      // Validate input data
      const validatedData = preferenceSchema.parse(data);

      // Encrypt sensitive fields
      const encryptedData = {
        ...validatedData,
        dietaryRestrictions: this.encryptField(validatedData.dietaryRestrictions),
        accessibilityNeeds: this.encryptField(validatedData.accessibilityNeeds),
        specialRequests: this.encryptField(JSON.stringify(validatedData.specialRequests))
      };

      // Create with transaction
      const preference = await this.prisma.$transaction(async (tx) => {
        return tx.preference.create({
          data: encryptedData
        });
      });

      return preference;
    } catch (error) {
      throw new Error(`Failed to create preference: ${error.message}`);
    }
  }

  /**
   * Updates existing preference with validation and encryption
   */
  async update(id: UUID, data: Partial<Preference>): Promise<Preference> {
    try {
      // Validate update data
      const validatedUpdate = preferenceSchema.partial().parse(data);

      // Encrypt sensitive fields if present
      const encryptedUpdate = {
        ...validatedUpdate,
        ...(validatedUpdate.dietaryRestrictions && {
          dietaryRestrictions: this.encryptField(validatedUpdate.dietaryRestrictions)
        }),
        ...(validatedUpdate.accessibilityNeeds && {
          accessibilityNeeds: this.encryptField(validatedUpdate.accessibilityNeeds)
        }),
        ...(validatedUpdate.specialRequests && {
          specialRequests: this.encryptField(JSON.stringify(validatedUpdate.specialRequests))
        })
      };

      const preference = await this.prisma.preference.update({
        where: { id },
        data: encryptedUpdate
      });

      return preference;
    } catch (error) {
      throw new Error(`Failed to update preference: ${error.message}`);
    }
  }

  /**
   * Retrieves and decrypts guest preferences
   */
  async findByGuestId(guestId: UUID): Promise<Preference> {
    try {
      const preference = await this.prisma.preference.findUnique({
        where: { guestId }
      });

      if (!preference) {
        throw new Error('Preference not found');
      }

      // Decrypt sensitive fields
      return {
        ...preference,
        dietaryRestrictions: this.decryptField(preference.dietaryRestrictions),
        accessibilityNeeds: this.decryptField(preference.accessibilityNeeds),
        specialRequests: JSON.parse(this.decryptField(preference.specialRequests))
      };
    } catch (error) {
      throw new Error(`Failed to retrieve preference: ${error.message}`);
    }
  }

  /**
   * Soft deletes preference with audit trail
   */
  async delete(id: UUID): Promise<Preference> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Create audit log
        await tx.auditLog.create({
          data: {
            entityType: 'preference',
            entityId: id,
            action: 'DELETE',
            timestamp: new Date()
          }
        });

        // Soft delete
        return tx.preference.update({
          where: { id },
          data: { deletedAt: new Date() }
        });
      });
    } catch (error) {
      throw new Error(`Failed to delete preference: ${error.message}`);
    }
  }
}