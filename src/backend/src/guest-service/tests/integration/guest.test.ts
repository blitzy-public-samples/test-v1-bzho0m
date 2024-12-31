/**
 * @fileoverview Integration tests for guest service API endpoints with enhanced security,
 * GDPR compliance, and error handling validation.
 * @version 1.0.0
 */

// External imports
import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { of, throwError } from 'rxjs'; // v7.8.0
import { KMS } from '@aws-sdk/client-kms'; // v3.0.0

// Internal imports
import { GuestController } from '../../src/controllers/guest.controller';
import { GuestService } from '../../src/services/guest.service';
import { AuditService } from '../../../shared/services/audit.service';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { Guest } from '../../src/models/guest.model';
import { CreateGuestDto, UpdateGuestDto } from '../../src/dto';
import { validateRequest } from '../../../shared/utils/validation.util';

describe('GuestController Integration Tests', () => {
  let module: TestingModule;
  let controller: GuestController;
  let service: GuestService;
  let auditService: AuditService;
  let kmsClient: KMS;

  const mockKmsKey = 'mock-kms-key-id';

  beforeEach(async () => {
    // Create testing module with mocked dependencies
    module = await Test.createTestingModule({
      controllers: [GuestController],
      providers: [
        {
          provide: GuestService,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            encryptPII: jest.fn(),
            decryptPII: jest.fn(),
            maskSensitiveData: jest.fn(),
            validateGuestData: jest.fn(),
            handleGDPRConsent: jest.fn()
          }
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn()
          }
        },
        {
          provide: KMS,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<GuestController>(GuestController);
    service = module.get<GuestService>(GuestService);
    auditService = module.get<AuditService>(AuditService);
    kmsClient = module.get<KMS>(KMS);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('Create Guest Profile Tests', () => {
    it('should create guest profile with encrypted PII and GDPR consent', (done) => {
      // Arrange
      const createDto: CreateGuestDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0123',
        documentNumber: 'ABC123456',
        gdprConsent: true,
        preferences: {
          language: 'en',
          newsletter: true
        }
      };

      const encryptedGuest = {
        ...createDto,
        email: 'encrypted_email',
        phone: 'encrypted_phone',
        documentNumber: 'encrypted_doc'
      };

      const maskedGuest = {
        ...encryptedGuest,
        phone: '****0123',
        documentNumber: '****3456'
      };

      jest.spyOn(service, 'create').mockReturnValue(of(maskedGuest));
      jest.spyOn(service, 'encryptPII').mockResolvedValue(encryptedGuest);
      jest.spyOn(auditService, 'log').mockResolvedValue(undefined);

      // Act & Assert
      controller.create(createDto).subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          expect(result.email).toBe('encrypted_email');
          expect(result.phone).toMatch(/^\*{4}\d{4}$/);
          expect(result.documentNumber).toMatch(/^\*{4}\d{4}$/);
          expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
            gdprConsent: true
          }));
          expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
            action: 'CREATE_GUEST'
          }));
          done();
        },
        error: done
      });
    });

    it('should reject creation without GDPR consent', (done) => {
      // Arrange
      const createDto: CreateGuestDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        gdprConsent: false
      };

      jest.spyOn(service, 'create').mockReturnValue(
        throwError(() => ({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'GDPR consent required'
        }))
      );

      // Act & Assert
      controller.create(createDto).subscribe({
        error: (error) => {
          expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(error.message).toContain('GDPR consent required');
          expect(service.create).not.toHaveBeenCalled();
          done();
        }
      });
    });
  });

  describe('Guest Profile Security Tests', () => {
    it('should properly mask sensitive data in responses', (done) => {
      // Arrange
      const guestId = 'test-uuid';
      const guest: Guest = {
        id: guestId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'encrypted_email',
        phone: 'encrypted_phone',
        documentNumber: 'encrypted_doc',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const maskedGuest = {
        ...guest,
        phone: '****1234',
        documentNumber: '****5678'
      };

      jest.spyOn(service, 'findById').mockReturnValue(of(maskedGuest));

      // Act & Assert
      controller.findById(guestId).subscribe({
        next: (result) => {
          expect(result.phone).toMatch(/^\*{4}\d{4}$/);
          expect(result.documentNumber).toMatch(/^\*{4}\d{4}$/);
          expect(result.email).toBe('encrypted_email');
          done();
        },
        error: done
      });
    });

    it('should enforce encryption for PII fields', (done) => {
      // Arrange
      const updateDto: UpdateGuestDto = {
        phone: '+1-555-9876',
        email: 'new.email@example.com'
      };

      jest.spyOn(kmsClient, 'encrypt').mockImplementation((params) => {
        return Promise.resolve({
          CiphertextBlob: Buffer.from('encrypted_data')
        });
      });

      jest.spyOn(service, 'update').mockImplementation((id, data) => {
        expect(data.phone).not.toBe(updateDto.phone);
        expect(data.email).not.toBe(updateDto.email);
        return of({ ...data, id: 'test-uuid' });
      });

      // Act & Assert
      controller.update('test-uuid', updateDto).subscribe({
        next: (result) => {
          expect(kmsClient.encrypt).toHaveBeenCalledTimes(2); // Once for each PII field
          done();
        },
        error: done
      });
    });
  });

  describe('GDPR Compliance Tests', () => {
    it('should handle right to be forgotten request', (done) => {
      // Arrange
      const guestId = 'test-uuid';
      jest.spyOn(service, 'delete').mockReturnValue(of(true));
      jest.spyOn(auditService, 'log').mockResolvedValue(undefined);

      // Act & Assert
      controller.delete(guestId).subscribe({
        next: (result) => {
          expect(result).toBe(true);
          expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
            action: 'DELETE_GUEST',
            entityType: 'GUEST'
          }));
          done();
        },
        error: done
      });
    });

    it('should validate data retention policies', (done) => {
      // Arrange
      const guestId = 'test-uuid';
      const guest: Guest = {
        id: guestId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'deleted_test-uuid@deleted.com',
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service, 'findById').mockReturnValue(of(guest));

      // Act & Assert
      controller.findById(guestId).subscribe({
        next: (result) => {
          expect(result.email).toBe('deleted_test-uuid@deleted.com');
          expect(result.deletedAt).toBeDefined();
          expect(result.phone).toBeNull();
          done();
        },
        error: done
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle validation errors properly', (done) => {
      // Arrange
      const invalidDto: CreateGuestDto = {
        firstName: '',
        lastName: '',
        email: 'invalid-email',
        gdprConsent: true
      };

      jest.spyOn(service, 'validateGuestData').mockRejectedValue({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid email format'
      });

      // Act & Assert
      controller.create(invalidDto).subscribe({
        error: (error) => {
          expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(error.message).toContain('Invalid email format');
          expect(service.create).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should handle database errors with retry mechanism', (done) => {
      // Arrange
      const guestId = 'test-uuid';
      let attempts = 0;

      jest.spyOn(service, 'findById').mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return throwError(() => ({
            code: ErrorCode.DATABASE_ERROR,
            message: 'Database connection failed'
          }));
        }
        return of({ id: guestId, firstName: 'John' });
      });

      // Act & Assert
      controller.findById(guestId).subscribe({
        next: (result) => {
          expect(attempts).toBe(3);
          expect(result.id).toBe(guestId);
          done();
        },
        error: done
      });
    });
  });
});