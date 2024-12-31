/**
 * @fileoverview Implements secure guest data management with encryption, audit logging and GDPR compliance
 * @version 1.0.0
 */

// External imports
import { PrismaClient } from '@prisma/client'; // v5.0.0
import { z } from 'zod'; // v3.21.4
import { 
  KMSClient, 
  EncryptCommand, 
  DecryptCommand 
} from '@aws-sdk/client-kms'; // v3.0.0
import { 
  CloudWatchClient, 
  PutMetricDataCommand 
} from '@aws-sdk/client-cloudwatch'; // v3.0.0

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';

/**
 * Zod schema for validating guest data
 */
const guestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  address: z.string().max(200),
  city: z.string().max(100),
  state: z.string().max(100),
  country: z.string().max(100),
  postalCode: z.string().max(20),
  idType: z.enum(['PASSPORT', 'DRIVING_LICENSE', 'NATIONAL_ID']),
  idNumber: z.string().min(5).max(50),
  dateOfBirth: z.date(),
  nationality: z.string().max(100),
  language: z.string().max(50),
  vipStatus: z.enum(['NONE', 'SILVER', 'GOLD', 'PLATINUM']).default('NONE'),
  documents: z.record(z.string()).optional(),
  isActive: z.boolean().default(true),
  encryptionKeyId: z.string().optional(),
  lastAccessedAt: z.date().optional(),
  dataRetentionPolicy: z.enum(['GDPR_STANDARD', 'EXTENDED_RETENTION']).default('GDPR_STANDARD')
});

/**
 * Interface defining the structure of guest data with enhanced security
 */
export interface Guest extends BaseModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  idType: string;
  idNumber: string;
  dateOfBirth: Date;
  nationality: string;
  language: string;
  vipStatus: string;
  documents?: Record<string, any>;
  isActive: boolean;
  encryptionKeyId?: string;
  lastAccessedAt?: Date;
  dataRetentionPolicy: string;
}

/**
 * Implements secure guest data management with encryption and audit logging
 */
export class GuestModel {
  private readonly prisma: PrismaClient;
  private readonly kmsClient: KMSClient;
  private readonly cloudWatch: CloudWatchClient;
  private readonly ENCRYPTION_KEY_ARN: string;
  
  constructor() {
    this.prisma = new PrismaClient();
    this.kmsClient = new KMSClient({ region: process.env.AWS_REGION });
    this.cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });
    this.ENCRYPTION_KEY_ARN = process.env.KMS_KEY_ARN || '';
    
    if (!this.ENCRYPTION_KEY_ARN) {
      throw new Error('KMS key ARN is required for guest data encryption');
    }
  }

  /**
   * Encrypts sensitive guest data using AWS KMS
   */
  private async encryptSensitiveData(data: string): Promise<{ encryptedData: string; keyId: string }> {
    const command = new EncryptCommand({
      KeyId: this.ENCRYPTION_KEY_ARN,
      Plaintext: Buffer.from(data)
    });
    
    const response = await this.kmsClient.send(command);
    return {
      encryptedData: response.CiphertextBlob?.toString('base64') || '',
      keyId: response.KeyId || ''
    };
  }

  /**
   * Decrypts sensitive guest data using AWS KMS
   */
  private async decryptSensitiveData(encryptedData: string): Promise<string> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedData, 'base64')
    });
    
    const response = await this.kmsClient.send(command);
    return response.Plaintext?.toString() || '';
  }

  /**
   * Logs guest data access to CloudWatch
   */
  private async logAccess(operation: string, guestId: string, userId: string): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'HotelERP/GuestService',
      MetricData: [{
        MetricName: 'GuestDataAccess',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Operation', Value: operation },
          { Name: 'GuestId', Value: guestId },
          { Name: 'UserId', Value: userId }
        ]
      }]
    });
    
    await this.cloudWatch.send(command);
  }

  /**
   * Creates a new guest record with encrypted sensitive data
   */
  async create(data: Omit<Guest, keyof BaseModel>): Promise<Guest> {
    // Validate input data
    const validatedData = guestSchema.parse(data);
    
    // Encrypt sensitive data
    const [emailEncrypted, phoneEncrypted, idNumberEncrypted] = await Promise.all([
      this.encryptSensitiveData(validatedData.email),
      this.encryptSensitiveData(validatedData.phone),
      this.encryptSensitiveData(validatedData.idNumber)
    ]);

    const guest = await this.prisma.guest.create({
      data: {
        ...validatedData,
        email: emailEncrypted.encryptedData,
        phone: phoneEncrypted.encryptedData,
        idNumber: idNumberEncrypted.encryptedData,
        encryptionKeyId: emailEncrypted.keyId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    await this.logAccess('CREATE', guest.id, 'system');
    return guest;
  }

  /**
   * Updates an existing guest record with security checks
   */
  async update(id: string, data: Partial<Guest>): Promise<Guest> {
    const existingGuest = await this.prisma.guest.findUnique({ where: { id } });
    if (!existingGuest) {
      throw new Error('Guest not found');
    }

    const updateData: any = { ...data, updatedAt: new Date() };

    // Encrypt any updated sensitive fields
    if (data.email) {
      const encrypted = await this.encryptSensitiveData(data.email);
      updateData.email = encrypted.encryptedData;
      updateData.encryptionKeyId = encrypted.keyId;
    }
    if (data.phone) {
      const encrypted = await this.encryptSensitiveData(data.phone);
      updateData.phone = encrypted.encryptedData;
    }
    if (data.idNumber) {
      const encrypted = await this.encryptSensitiveData(data.idNumber);
      updateData.idNumber = encrypted.encryptedData;
    }

    const updatedGuest = await this.prisma.guest.update({
      where: { id },
      data: updateData
    });

    await this.logAccess('UPDATE', id, 'system');
    return updatedGuest;
  }

  /**
   * Retrieves a guest by ID with security logging
   */
  async findById(id: string): Promise<Guest> {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      throw new Error('Guest not found');
    }

    // Decrypt sensitive data
    const [email, phone, idNumber] = await Promise.all([
      this.decryptSensitiveData(guest.email),
      this.decryptSensitiveData(guest.phone),
      this.decryptSensitiveData(guest.idNumber)
    ]);

    await this.prisma.guest.update({
      where: { id },
      data: { lastAccessedAt: new Date() }
    });

    await this.logAccess('READ', id, 'system');

    return {
      ...guest,
      email,
      phone,
      idNumber
    };
  }

  /**
   * Implements secure guest data deletion with GDPR compliance
   */
  async delete(id: string): Promise<Guest> {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      throw new Error('Guest not found');
    }

    const deletedGuest = await this.prisma.guest.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: '',
        phone: '',
        idNumber: '',
        documents: {}
      }
    });

    await this.logAccess('DELETE', id, 'system');
    return deletedGuest;
  }
}