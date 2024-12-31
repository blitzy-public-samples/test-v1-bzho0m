/**
 * @fileoverview Unit tests for guest preference functionality including CRUD operations,
 * data security, validation, and service layer integration.
 * @version 1.0.0
 */

// External imports - versions specified for production stability
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // v29.0.0
import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { faker } from '@faker-js/faker'; // v8.0.0
import { UUID } from 'crypto';

// Internal imports
import { Preference, PreferenceModel } from '../../src/models/preference.model';
import { GuestService } from '../../src/services/guest.service';
import { ErrorCode } from '../../../shared/constants/error-codes';

describe('PreferenceModel', () => {
  let preferenceModel: PreferenceModel;
  let guestService: GuestService;
  let testModule: TestingModule;
  let mockEncryptionKey: string;
  let mockTransaction: any;

  // Mock data for testing
  const mockGuestId: UUID = faker.string.uuid();
  const mockPreferenceData: Partial<Preference> = {
    guestId: mockGuestId,
    roomType: 'DELUXE',
    floorLevel: 5,
    smokingRoom: false,
    bedType: ['KING'],
    pillowType: ['FIRM', 'HYPOALLERGENIC'],
    amenities: ['MINIBAR', 'WORKSPACE'],
    dietaryRestrictions: 'GLUTEN_FREE',
    temperature: '22',
    specialRequests: {
      extraTowels: true,
      earlyCheckIn: true
    },
    accessibilityNeeds: 'NONE',
    communicationPreferences: {
      language: 'EN',
      contactMethod: 'EMAIL'
    }
  };

  beforeEach(async () => {
    // Set up mock encryption key
    mockEncryptionKey = faker.string.alphanumeric(32);
    process.env.PREFERENCE_ENCRYPTION_KEY = mockEncryptionKey;

    // Create test module with mocked dependencies
    testModule = await Test.createTestingModule({
      providers: [
        PreferenceModel,
        {
          provide: GuestService,
          useValue: {
            validateGuestAccess: jest.fn().mockResolvedValue(true)
          }
        }
      ]
    }).compile();

    preferenceModel = testModule.get<PreferenceModel>(PreferenceModel);
    guestService = testModule.get<GuestService>(GuestService);

    // Mock database transaction
    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(preferenceModel['prisma'], '$transaction').mockImplementation(
      (fn) => fn(mockTransaction)
    );
  });

  afterEach(async () => {
    await testModule.close();
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    it('should create new preference with encrypted sensitive data', async () => {
      // Arrange
      const createSpy = jest.spyOn(preferenceModel['prisma'].preference, 'create');

      // Act
      const result = await preferenceModel.create(mockPreferenceData);

      // Assert
      expect(result).toBeDefined();
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(result.guestId).toBe(mockGuestId);
      expect(result.dietaryRestrictions).not.toBe(mockPreferenceData.dietaryRestrictions);
      expect(result.specialRequests).not.toBe(JSON.stringify(mockPreferenceData.specialRequests));
    });

    it('should retrieve and decrypt preference data', async () => {
      // Arrange
      const findSpy = jest.spyOn(preferenceModel['prisma'].preference, 'findUnique')
        .mockResolvedValue({ ...mockPreferenceData, id: faker.string.uuid() });

      // Act
      const result = await preferenceModel.findByGuestId(mockGuestId);

      // Assert
      expect(result).toBeDefined();
      expect(findSpy).toHaveBeenCalledWith({ where: { guestId: mockGuestId } });
      expect(result.dietaryRestrictions).toBe(mockPreferenceData.dietaryRestrictions);
      expect(JSON.stringify(result.specialRequests)).toBe(
        JSON.stringify(mockPreferenceData.specialRequests)
      );
    });

    it('should update preference with partial data', async () => {
      // Arrange
      const updateData: Partial<Preference> = {
        temperature: '24',
        pillowType: ['SOFT']
      };
      const updateSpy = jest.spyOn(preferenceModel['prisma'].preference, 'update');

      // Act
      const result = await preferenceModel.update(mockGuestId, updateData);

      // Assert
      expect(result).toBeDefined();
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(result.temperature).toBe(updateData.temperature);
      expect(result.pillowType).toEqual(updateData.pillowType);
    });

    it('should soft delete preference with audit trail', async () => {
      // Arrange
      const preferenceId = faker.string.uuid();
      const deleteSpy = jest.spyOn(preferenceModel['prisma'].preference, 'update');
      const auditSpy = jest.spyOn(preferenceModel['prisma'].auditLog, 'create');

      // Act
      const result = await preferenceModel.delete(preferenceId);

      // Assert
      expect(result).toBeDefined();
      expect(deleteSpy).toHaveBeenCalledWith({
        where: { id: preferenceId },
        data: { deletedAt: expect.any(Date) }
      });
      expect(auditSpy).toHaveBeenCalledWith({
        data: {
          entityType: 'preference',
          entityId: preferenceId,
          action: 'DELETE',
          timestamp: expect.any(Date)
        }
      });
    });
  });

  describe('Data Security', () => {
    it('should properly encrypt sensitive fields', async () => {
      // Arrange
      const sensitiveData = {
        dietaryRestrictions: 'CONFIDENTIAL_INFO',
        accessibilityNeeds: 'SENSITIVE_DETAILS'
      };

      // Act
      const result = await preferenceModel.create({
        ...mockPreferenceData,
        ...sensitiveData
      });

      // Assert
      expect(result.dietaryRestrictions).not.toBe(sensitiveData.dietaryRestrictions);
      expect(result.accessibilityNeeds).not.toBe(sensitiveData.accessibilityNeeds);
      expect(typeof result.dietaryRestrictions).toBe('string');
      expect(typeof result.accessibilityNeeds).toBe('string');
    });

    it('should handle encryption key rotation', async () => {
      // Arrange
      const oldKey = mockEncryptionKey;
      const newKey = faker.string.alphanumeric(32);
      process.env.PREFERENCE_ENCRYPTION_KEY = newKey;

      // Act
      const result = await preferenceModel.create(mockPreferenceData);
      process.env.PREFERENCE_ENCRYPTION_KEY = oldKey;
      const decrypted = await preferenceModel.findByGuestId(mockGuestId);

      // Assert
      expect(result.dietaryRestrictions).not.toBe(decrypted.dietaryRestrictions);
      expect(() => preferenceModel.decryptField(result.dietaryRestrictions))
        .toThrow();
    });

    it('should validate access control', async () => {
      // Arrange
      const unauthorizedGuestId = faker.string.uuid();
      jest.spyOn(guestService, 'validateGuestAccess')
        .mockResolvedValueOnce(false);

      // Act & Assert
      await expect(
        preferenceModel.findByGuestId(unauthorizedGuestId)
      ).rejects.toThrow(ErrorCode.AUTHORIZATION_ERROR);
    });
  });

  describe('Validation', () => {
    it('should validate preference data structure', async () => {
      // Arrange
      const invalidData = {
        ...mockPreferenceData,
        roomType: 'INVALID_TYPE',
        temperature: '50' // Outside valid range
      };

      // Act & Assert
      await expect(
        preferenceModel.create(invalidData)
      ).rejects.toThrow(ErrorCode.VALIDATION_ERROR);
    });

    it('should handle special characters in preferences', async () => {
      // Arrange
      const specialCharsData = {
        ...mockPreferenceData,
        specialRequests: {
          notes: '<script>alert("xss")</script>'
        }
      };

      // Act
      const result = await preferenceModel.create(specialCharsData);

      // Assert
      expect(result.specialRequests.notes).not.toContain('<script>');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      jest.spyOn(preferenceModel['prisma'], '$transaction')
        .mockRejectedValueOnce(new Error('Connection failed'));

      // Act & Assert
      await expect(
        preferenceModel.create(mockPreferenceData)
      ).rejects.toThrow('Failed to create preference');
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      jest.spyOn(preferenceModel['prisma'].preference, 'create')
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      try {
        await preferenceModel.create(mockPreferenceData);
      } catch (error) {
        // Assert
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(mockTransaction.commit).not.toHaveBeenCalled();
      }
    });
  });
});