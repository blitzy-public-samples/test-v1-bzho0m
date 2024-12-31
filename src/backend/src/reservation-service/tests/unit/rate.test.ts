/**
 * @fileoverview Unit tests for rate model and pricing calculations, validating dynamic pricing logic,
 * rate modifications, yield management, and revenue optimization through various pricing strategies.
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import dayjs from 'dayjs'; // v1.11.0
import { Rate, RateModel, RateType, RateStatus } from '../../src/models/rate.model';
import { PricingService } from '../../src/services/pricing.service';
import { ErrorCode } from '../../../shared/constants/error-codes';

describe('RateModel and PricingService Tests', () => {
  let rateModel: RateModel;
  let pricingService: PricingService;
  let mockLogger: any;
  let mockCacheManager: any;
  let mockRateAuditService: any;

  // Sample test data
  const sampleRate: Rate = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    roomTypeId: '123e4567-e89b-12d3-a456-426614174001',
    rateCode: 'STD-RACK',
    rateName: 'Standard Rack Rate',
    baseRate: 100.00,
    taxRate: 0.12,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: new Date('2024-12-31'),
    type: RateType.RACK,
    status: RateStatus.ACTIVE,
    seasonalModifiers: [
      {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 25,
        description: 'Summer Peak Season'
      }
    ],
    occupancyModifiers: [
      {
        occupancyThreshold: 80,
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 15
      }
    ],
    lengthOfStayModifiers: [
      {
        minimumNights: 7,
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: -15
      }
    ],
    applicableChannels: ['DIRECT', 'OTA'],
    isPromotional: false,
    minimumRate: 80.00,
    maximumRate: 200.00,
    channelRules: {
      'OTA': {
        channelId: 'OTA',
        markup: 0.15,
        minimumMarkup: 0.10,
        rateParity: true,
        restrictions: {
          minimumLOS: 1,
          maximumLOS: 30,
          closedToArrival: false,
          closedToDeparture: false
        }
      }
    },
    currencyCode: 'USD',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Initialize mocks
    mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    };

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn()
    };

    mockRateAuditService = {
      logRateCalculation: jest.fn()
    };

    // Initialize services
    rateModel = new RateModel();
    pricingService = new PricingService(rateModel, mockLogger, mockCacheManager, mockRateAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Creation and Validation', () => {
    test('should create a new rate with valid data', async () => {
      const result = await rateModel.calculateRate(
        sampleRate.id,
        new Date('2024-07-15'),
        new Date('2024-07-20'),
        75,
        'DIRECT'
      );

      expect(result).toBeGreaterThan(sampleRate.baseRate);
      expect(result).toBeLessThanOrEqual(sampleRate.maximumRate);
    });

    test('should enforce minimum rate bounds', async () => {
      const lowOccupancyDate = new Date('2024-01-15');
      const result = await rateModel.calculateRate(
        sampleRate.id,
        lowOccupancyDate,
        new Date('2024-01-20'),
        30,
        'DIRECT'
      );

      expect(result).toBeGreaterThanOrEqual(sampleRate.minimumRate);
    });

    test('should validate rate type transitions', async () => {
      const invalidRate = { ...sampleRate, type: 'INVALID_TYPE' };
      await expect(
        rateModel.calculateRate(
          invalidRate.id,
          new Date(),
          new Date(),
          75,
          'DIRECT'
        )
      ).rejects.toThrow(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('Dynamic Pricing Calculations', () => {
    test('should apply correct seasonal adjustments', async () => {
      const peakSeasonResult = await pricingService.calculateRoomRate(
        sampleRate.roomTypeId,
        new Date('2024-07-15'),
        new Date('2024-07-20'),
        75,
        'DIRECT'
      ).toPromise();

      expect(peakSeasonResult.breakdown.seasonalAdjustment).toBe(25);
      expect(peakSeasonResult.finalRate).toBeGreaterThan(sampleRate.baseRate * 1.25);
    });

    test('should calculate occupancy-based modifications', async () => {
      const highOccupancyResult = await pricingService.calculateRoomRate(
        sampleRate.roomTypeId,
        new Date('2024-07-15'),
        new Date('2024-07-20'),
        85,
        'DIRECT'
      ).toPromise();

      expect(highOccupancyResult.breakdown.occupancyAdjustment).toBeGreaterThan(0);
      expect(highOccupancyResult.appliedRules).toContain('Occupancy Based Pricing');
    });

    test('should apply length of stay discounts', async () => {
      const longStayResult = await pricingService.calculateRoomRate(
        sampleRate.roomTypeId,
        new Date('2024-07-15'),
        new Date('2024-07-22'), // 7 nights
        75,
        'DIRECT'
      ).toPromise();

      expect(longStayResult.breakdown.losAdjustment).toBeLessThan(0);
      expect(longStayResult.appliedRules).toContain('Length of Stay Discount');
    });
  });

  describe('Channel Rate Management', () => {
    test('should apply correct channel markup for OTA', async () => {
      const otaResult = await pricingService.calculateRoomRate(
        sampleRate.roomTypeId,
        new Date('2024-07-15'),
        new Date('2024-07-20'),
        75,
        'OTA'
      ).toPromise();

      expect(otaResult.breakdown.channelMarkup).toBeGreaterThan(0);
      expect(otaResult.finalRate).toBeGreaterThan(sampleRate.baseRate * 1.15);
    });

    test('should maintain rate parity across channels', async () => {
      const [directResult, otaResult] = await Promise.all([
        pricingService.calculateRoomRate(
          sampleRate.roomTypeId,
          new Date('2024-07-15'),
          new Date('2024-07-20'),
          75,
          'DIRECT'
        ).toPromise(),
        pricingService.calculateRoomRate(
          sampleRate.roomTypeId,
          new Date('2024-07-15'),
          new Date('2024-07-20'),
          75,
          'OTA'
        ).toPromise()
      ]);

      // OTA rate should be higher by exactly the markup percentage
      expect(otaResult.finalRate).toBeCloseTo(
        directResult.finalRate * (1 + sampleRate.channelRules['OTA'].markup),
        2
      );
    });
  });

  describe('Rate Caching', () => {
    test('should cache calculated rates', async () => {
      const cacheKey = `rate:${sampleRate.roomTypeId}:2024-07-15:2024-07-20:75:DIRECT`;
      
      mockCacheManager.get.mockResolvedValueOnce(null);
      
      await pricingService.calculateRoomRate(
        sampleRate.roomTypeId,
        new Date('2024-07-15'),
        new Date('2024-07-20'),
        75,
        'DIRECT'
      ).toPromise();

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Object),
        15 * 60 * 1000
      );
    });

    test('should use cached rates when available', async () => {
      const cachedRate = {
        finalRate: 150.00,
        baseRate: 100.00,
        breakdown: {
          seasonalAdjustment: 25,
          occupancyAdjustment: 0,
          losAdjustment: 0,
          channelMarkup: 0,
          taxes: 25
        },
        appliedRules: ['Seasonal Adjustment'],
        validUntil: new Date(Date.now() + 15 * 60 * 1000)
      };

      mockCacheManager.get.mockResolvedValueOnce(cachedRate);

      const result = await pricingService.calculateRoomRate(
        sampleRate.roomTypeId,
        new Date('2024-07-15'),
        new Date('2024-07-20'),
        75,
        'DIRECT'
      ).toPromise();

      expect(result).toEqual(cachedRate);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid date ranges', async () => {
      await expect(
        pricingService.calculateRoomRate(
          sampleRate.roomTypeId,
          new Date('2024-07-20'),
          new Date('2024-07-15'), // Check-out before check-in
          75,
          'DIRECT'
        ).toPromise()
      ).rejects.toThrow(ErrorCode.VALIDATION_ERROR);
    });

    test('should validate occupancy percentage bounds', async () => {
      await expect(
        pricingService.calculateRoomRate(
          sampleRate.roomTypeId,
          new Date('2024-07-15'),
          new Date('2024-07-20'),
          150, // Invalid occupancy percentage
          'DIRECT'
        ).toPromise()
      ).rejects.toThrow(ErrorCode.VALIDATION_ERROR);
    });
  });
});