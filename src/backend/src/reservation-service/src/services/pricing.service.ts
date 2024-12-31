/**
 * @fileoverview Implements dynamic pricing and yield management service for hotel room rates.
 * Handles sophisticated pricing strategies including seasonal adjustments, occupancy-based pricing,
 * length-of-stay discounts, and channel-specific rate management with caching optimizations.
 * @version 1.0.0
 */

// External imports
import { Injectable, Logger } from '@nestjs/common'; // v10.0.0
import { Observable, from, of } from 'rxjs'; // v7.8.0
import { map, catchError, retry } from 'rxjs/operators';

// Internal imports
import { BaseService } from '../../../shared/interfaces/base-service.interface';
import { 
  Rate, RateModel, RateType, RateStatus, RateAudit, ChannelRate 
} from '../models/rate.model';
import { 
  formatDate, parseDate, calculateNights, isValidBookingRange, 
  getSeasonType 
} from '../../../shared/utils/date.util';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Interface for rate calculation result with detailed breakdown
 */
interface RateCalculationResult {
  finalRate: number;
  baseRate: number;
  breakdown: {
    seasonalAdjustment: number;
    occupancyAdjustment: number;
    losAdjustment: number;
    channelMarkup: number;
    taxes: number;
  };
  appliedRules: string[];
  validUntil: Date;
}

/**
 * Service responsible for dynamic pricing calculations and rate management
 */
@Injectable()
export class PricingService implements BaseService<Rate> {
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_BOUNDS_MARGIN = 0.15; // 15% margin for rate bounds

  constructor(
    private readonly rateModel: RateModel,
    private readonly logger: Logger,
    private readonly cacheManager: any,
    private readonly rateAuditService: any
  ) {
    this.logger.setContext('PricingService');
  }

  /**
   * Calculates room rate with all applicable modifiers and caching
   * @param roomTypeId - Room type identifier
   * @param checkInDate - Check-in date
   * @param checkOutDate - Check-out date
   * @param occupancyPercentage - Current hotel occupancy
   * @param channelId - Distribution channel identifier
   * @param additionalModifiers - Additional rate modifiers
   * @returns Observable with detailed rate calculation result
   */
  calculateRoomRate(
    roomTypeId: string,
    checkInDate: Date,
    checkOutDate: Date,
    occupancyPercentage: number,
    channelId: string,
    additionalModifiers?: Record<string, number>
  ): Observable<RateCalculationResult> {
    const cacheKey = `rate:${roomTypeId}:${checkInDate}:${checkOutDate}:${occupancyPercentage}:${channelId}`;

    return from(this.cacheManager.get(cacheKey)).pipe(
      map(cached => {
        if (cached) {
          this.logger.debug(`Cache hit for rate calculation: ${cacheKey}`);
          return cached as RateCalculationResult;
        }
        throw new Error('Cache miss');
      }),
      catchError(() => {
        return this.performRateCalculation(
          roomTypeId,
          checkInDate,
          checkOutDate,
          occupancyPercentage,
          channelId,
          additionalModifiers
        ).pipe(
          map(result => {
            this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;
          })
        );
      }),
      retry(3)
    );
  }

  /**
   * Performs detailed rate calculation with all modifiers
   */
  private performRateCalculation(
    roomTypeId: string,
    checkInDate: Date,
    checkOutDate: Date,
    occupancyPercentage: number,
    channelId: string,
    additionalModifiers?: Record<string, number>
  ): Observable<RateCalculationResult> {
    return from(this.rateModel.calculateRate(
      roomTypeId,
      checkInDate,
      checkOutDate,
      occupancyPercentage,
      channelId
    )).pipe(
      map(baseRate => {
        const nights = calculateNights(checkInDate, checkOutDate);
        const breakdown = {
          seasonalAdjustment: 0,
          occupancyAdjustment: 0,
          losAdjustment: 0,
          channelMarkup: 0,
          taxes: 0
        };

        // Calculate seasonal adjustment
        const seasonalModifier = this.calculateSeasonalModifier(checkInDate, checkOutDate);
        breakdown.seasonalAdjustment = baseRate * seasonalModifier;

        // Calculate occupancy adjustment
        const occupancyModifier = this.calculateOccupancyModifier(occupancyPercentage);
        breakdown.occupancyAdjustment = baseRate * occupancyModifier;

        // Calculate length of stay discount
        const losModifier = this.calculateLOSModifier(nights);
        breakdown.losAdjustment = baseRate * losModifier;

        // Apply channel markup
        const channelModifier = this.calculateChannelModifier(channelId);
        breakdown.channelMarkup = baseRate * channelModifier;

        // Calculate final rate before tax
        let finalRate = baseRate + 
          breakdown.seasonalAdjustment +
          breakdown.occupancyAdjustment +
          breakdown.losAdjustment +
          breakdown.channelMarkup;

        // Apply additional modifiers if provided
        if (additionalModifiers) {
          Object.values(additionalModifiers).forEach(modifier => {
            finalRate *= (1 + modifier);
          });
        }

        // Apply rate bounds protection
        finalRate = this.enforceRateBounds(finalRate, baseRate);

        // Calculate tax
        const TAX_RATE = 0.12; // 12% tax rate
        breakdown.taxes = finalRate * TAX_RATE;
        finalRate += breakdown.taxes;

        // Audit the rate calculation
        this.auditRateCalculation(
          roomTypeId,
          finalRate,
          breakdown,
          channelId
        );

        return {
          finalRate: Number(finalRate.toFixed(2)),
          baseRate: baseRate,
          breakdown,
          appliedRules: this.getAppliedRules(breakdown),
          validUntil: new Date(Date.now() + this.CACHE_TTL)
        };
      }),
      catchError(error => {
        this.logger.error(
          `Rate calculation failed: ${error.message}`,
          error.stack
        );
        throw new Error(ErrorCode.INTERNAL_SERVER_ERROR);
      })
    );
  }

  /**
   * Calculates seasonal rate modifier based on dates
   */
  private calculateSeasonalModifier(checkIn: Date, checkOut: Date): number {
    const seasonType = getSeasonType(checkIn);
    const modifiers = {
      HIGH: 0.25,    // 25% increase
      SHOULDER: 0.1, // 10% increase
      LOW: -0.15     // 15% decrease
    };
    return modifiers[seasonType] || 0;
  }

  /**
   * Calculates occupancy-based rate modifier
   */
  private calculateOccupancyModifier(occupancyPercentage: number): number {
    if (occupancyPercentage >= 90) return 0.2;  // 20% increase
    if (occupancyPercentage >= 80) return 0.15; // 15% increase
    if (occupancyPercentage >= 70) return 0.1;  // 10% increase
    if (occupancyPercentage <= 30) return -0.1; // 10% decrease
    return 0;
  }

  /**
   * Calculates length of stay discount
   */
  private calculateLOSModifier(nights: number): number {
    if (nights >= 14) return -0.2;  // 20% discount
    if (nights >= 7) return -0.15;  // 15% discount
    if (nights >= 4) return -0.1;   // 10% discount
    return 0;
  }

  /**
   * Calculates channel-specific markup
   */
  private calculateChannelModifier(channelId: string): number {
    const channelMarkups = {
      DIRECT: 0,      // No markup for direct bookings
      OTA: 0.15,      // 15% markup for OTAs
      CORPORATE: 0.1, // 10% markup for corporate bookings
      WHOLESALE: 0.2  // 20% markup for wholesale
    };
    return channelMarkups[channelId] || 0;
  }

  /**
   * Enforces minimum and maximum rate bounds
   */
  private enforceRateBounds(calculatedRate: number, baseRate: number): number {
    const minRate = baseRate * (1 - this.RATE_BOUNDS_MARGIN);
    const maxRate = baseRate * (1 + this.RATE_BOUNDS_MARGIN);
    return Math.min(Math.max(calculatedRate, minRate), maxRate);
  }

  /**
   * Generates list of applied pricing rules
   */
  private getAppliedRules(breakdown: any): string[] {
    const rules = [];
    if (breakdown.seasonalAdjustment !== 0) rules.push('Seasonal Adjustment');
    if (breakdown.occupancyAdjustment !== 0) rules.push('Occupancy Based Pricing');
    if (breakdown.losAdjustment !== 0) rules.push('Length of Stay Discount');
    if (breakdown.channelMarkup !== 0) rules.push('Channel Markup');
    return rules;
  }

  /**
   * Audits rate calculation for compliance and tracking
   */
  private auditRateCalculation(
    roomTypeId: string,
    finalRate: number,
    breakdown: any,
    channelId: string
  ): void {
    this.rateAuditService.logRateCalculation({
      roomTypeId,
      finalRate,
      breakdown,
      channelId,
      timestamp: new Date(),
      calculatedBy: 'PricingService'
    });
  }
}