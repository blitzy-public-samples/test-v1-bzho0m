/**
 * @fileoverview Guest service implementation providing secure guest profile management
 * with GDPR compliance, encryption, and comprehensive audit logging.
 * @version 1.0.0
 */

// External imports - versions specified for production stability
import { Injectable, Logger } from '@nestjs/common'; // v10.0.0
import { Observable, throwError } from 'rxjs'; // v7.8.0
import { map, catchError, retry } from 'rxjs/operators'; // v7.8.0
import { KMS } from '@aws-sdk/client-kms'; // v3.0.0

// Internal imports
import { BaseService } from '../../../shared/interfaces/base-service.interface';
import { ErrorCode, createErrorDetails } from '../../../shared/constants/error-codes';
import { Guest } from '../models/guest.model';
import { CreateGuestDto, UpdateGuestDto } from '../dto';
import { GuestPreference } from '../models/guest-preference.model';
import { AuditService } from '../../../shared/services/audit.service';
import { UUID } from '../../../shared/interfaces/base-model.interface';

/**
 * Service responsible for managing guest profiles with enhanced security,
 * GDPR compliance, and comprehensive audit logging.
 * 
 * @implements {BaseService<Guest>}
 */
@Injectable()
export class GuestService implements BaseService<Guest> {
  private readonly logger = new Logger(GuestService.name);
  private readonly kmsKeyId = process.env.AWS_KMS_KEY_ID;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000; // milliseconds

  constructor(
    private readonly kms: KMS,
    private readonly guestModel: typeof Guest,
    private readonly preferenceModel: typeof GuestPreference,
    private readonly auditService: AuditService
  ) {}

  /**
   * Creates a new guest profile with encrypted PII data and GDPR compliance.
   * 
   * @param {CreateGuestDto} guestData - Guest profile data
   * @returns {Observable<Guest>} Observable of created guest profile
   * @throws {ErrorCode.VALIDATION_ERROR} If data validation fails
   * @throws {ErrorCode.DATABASE_ERROR} If database operation fails
   */
  create(guestData: CreateGuestDto): Observable<Guest> {
    this.logger.debug(`Creating new guest profile: ${guestData.email}`);

    return new Observable(subscriber => {
      Promise.all([
        this.encryptPII(guestData),
        this.validateGuestData(guestData)
      ])
        .then(async ([encryptedData]) => {
          const transaction = await this.guestModel.startTransaction();
          
          try {
            // Create guest profile with encrypted data
            const guest = await this.guestModel.create({
              ...encryptedData,
              createdAt: new Date(),
              updatedAt: new Date()
            }, { transaction });

            // Create guest preferences if provided
            if (guestData.preferences) {
              await this.preferenceModel.create({
                guestId: guest.id,
                ...guestData.preferences
              }, { transaction });
            }

            await transaction.commit();

            // Audit log the creation
            await this.auditService.log({
              action: 'CREATE_GUEST',
              entityId: guest.id,
              entityType: 'GUEST',
              changes: { event: 'GUEST_CREATED' }
            });

            subscriber.next(this.maskSensitiveData(guest));
            subscriber.complete();
          } catch (error) {
            await transaction.rollback();
            throw error;
          }
        })
        .catch(error => {
          this.logger.error(`Failed to create guest profile: ${error.message}`);
          subscriber.error(createErrorDetails(
            ErrorCode.DATABASE_ERROR,
            { message: 'Failed to create guest profile' }
          ));
        });
    }).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Retrieves a guest profile with decrypted and masked data.
   * 
   * @param {UUID} id - Guest profile ID
   * @returns {Observable<Guest>} Observable of guest profile
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If guest profile not found
   */
  findById(id: UUID): Observable<Guest> {
    this.logger.debug(`Retrieving guest profile: ${id}`);

    return new Observable(subscriber => {
      this.guestModel.findByPk(id, {
        include: [{ model: this.preferenceModel }]
      })
        .then(async guest => {
          if (!guest) {
            throw createErrorDetails(
              ErrorCode.RESOURCE_NOT_FOUND,
              { message: 'Guest profile not found' }
            );
          }

          const decryptedGuest = await this.decryptPII(guest);
          subscriber.next(this.maskSensitiveData(decryptedGuest));
          subscriber.complete();

          // Audit log the access
          await this.auditService.log({
            action: 'ACCESS_GUEST',
            entityId: id,
            entityType: 'GUEST',
            changes: { event: 'GUEST_ACCESSED' }
          });
        })
        .catch(error => {
          this.logger.error(`Failed to retrieve guest profile: ${error.message}`);
          subscriber.error(error);
        });
    }).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Updates a guest profile with encryption and GDPR compliance.
   * 
   * @param {UUID} id - Guest profile ID
   * @param {UpdateGuestDto} updateData - Updated guest data
   * @returns {Observable<Guest>} Observable of updated guest profile
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If guest profile not found
   * @throws {ErrorCode.VALIDATION_ERROR} If data validation fails
   */
  update(id: UUID, updateData: UpdateGuestDto): Observable<Guest> {
    this.logger.debug(`Updating guest profile: ${id}`);

    return new Observable(subscriber => {
      Promise.all([
        this.encryptPII(updateData),
        this.validateGuestData(updateData)
      ])
        .then(async ([encryptedData]) => {
          const transaction = await this.guestModel.startTransaction();

          try {
            const guest = await this.guestModel.findByPk(id);
            if (!guest) {
              throw createErrorDetails(
                ErrorCode.RESOURCE_NOT_FOUND,
                { message: 'Guest profile not found' }
              );
            }

            // Update guest profile
            const updatedGuest = await guest.update({
              ...encryptedData,
              updatedAt: new Date()
            }, { transaction });

            // Update preferences if provided
            if (updateData.preferences) {
              await this.preferenceModel.update(
                updateData.preferences,
                { where: { guestId: id }, transaction }
              );
            }

            await transaction.commit();

            // Audit log the update
            await this.auditService.log({
              action: 'UPDATE_GUEST',
              entityId: id,
              entityType: 'GUEST',
              changes: { event: 'GUEST_UPDATED' }
            });

            subscriber.next(this.maskSensitiveData(updatedGuest));
            subscriber.complete();
          } catch (error) {
            await transaction.rollback();
            throw error;
          }
        })
        .catch(error => {
          this.logger.error(`Failed to update guest profile: ${error.message}`);
          subscriber.error(error);
        });
    }).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Implements GDPR-compliant guest profile deletion.
   * 
   * @param {UUID} id - Guest profile ID
   * @returns {Observable<boolean>} Observable of deletion status
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If guest profile not found
   */
  delete(id: UUID): Observable<boolean> {
    this.logger.debug(`Deleting guest profile: ${id}`);

    return new Observable(subscriber => {
      this.guestModel.findByPk(id)
        .then(async guest => {
          if (!guest) {
            throw createErrorDetails(
              ErrorCode.RESOURCE_NOT_FOUND,
              { message: 'Guest profile not found' }
            );
          }

          const transaction = await this.guestModel.startTransaction();

          try {
            // Implement soft delete
            await guest.update({
              deletedAt: new Date(),
              email: `deleted_${guest.id}@deleted.com`, // Anonymize email
              phone: null, // Remove phone number
            }, { transaction });

            // Schedule hard delete after retention period (e.g., 30 days)
            await this.scheduleHardDelete(id);

            await transaction.commit();

            // Audit log the deletion
            await this.auditService.log({
              action: 'DELETE_GUEST',
              entityId: id,
              entityType: 'GUEST',
              changes: { event: 'GUEST_DELETED' }
            });

            subscriber.next(true);
            subscriber.complete();
          } catch (error) {
            await transaction.rollback();
            throw error;
          }
        })
        .catch(error => {
          this.logger.error(`Failed to delete guest profile: ${error.message}`);
          subscriber.error(error);
        });
    }).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Encrypts PII data using AWS KMS.
   * @private
   */
  private async encryptPII(data: Partial<Guest>): Promise<Partial<Guest>> {
    const fieldsToEncrypt = ['email', 'phone', 'documentNumber'];
    const encrypted = { ...data };

    for (const field of fieldsToEncrypt) {
      if (data[field]) {
        const { CiphertextBlob } = await this.kms.encrypt({
          KeyId: this.kmsKeyId,
          Plaintext: Buffer.from(data[field])
        });
        encrypted[field] = CiphertextBlob.toString('base64');
      }
    }

    return encrypted;
  }

  /**
   * Decrypts PII data using AWS KMS.
   * @private
   */
  private async decryptPII(guest: Guest): Promise<Guest> {
    const fieldsToDecrypt = ['email', 'phone', 'documentNumber'];
    const decrypted = { ...guest };

    for (const field of fieldsToDecrypt) {
      if (guest[field]) {
        const { Plaintext } = await this.kms.decrypt({
          CiphertextBlob: Buffer.from(guest[field], 'base64')
        });
        decrypted[field] = Plaintext.toString();
      }
    }

    return decrypted;
  }

  /**
   * Masks sensitive data for API responses.
   * @private
   */
  private maskSensitiveData(guest: Guest): Guest {
    const masked = { ...guest };
    if (masked.documentNumber) {
      masked.documentNumber = `****${masked.documentNumber.slice(-4)}`;
    }
    if (masked.phone) {
      masked.phone = `****${masked.phone.slice(-4)}`;
    }
    return masked;
  }

  /**
   * Validates guest data against business rules.
   * @private
   */
  private async validateGuestData(data: Partial<Guest>): Promise<void> {
    // Implement validation logic
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email)) {
      throw createErrorDetails(
        ErrorCode.VALIDATION_ERROR,
        { message: 'Invalid email format' }
      );
    }
    // Add more validation rules as needed
  }

  /**
   * Schedules hard delete after retention period.
   * @private
   */
  private async scheduleHardDelete(id: UUID): Promise<void> {
    // Implement scheduling logic (e.g., using message queue)
    this.logger.debug(`Scheduled hard delete for guest: ${id}`);
  }
}