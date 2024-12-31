/**
 * @fileoverview Defines the rate model schema and interface for managing dynamic room rates,
 * implementing yield management, seasonal adjustments, and rate modifiers for the hotel 
 * reservation system with enhanced channel parity and revenue optimization features.
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client'; // v5.0.0
import dayjs from 'dayjs'; // v1.11.0
import { BaseModel } from '../../../shared/interfaces/base-model.interface';
import { UUID } from 'crypto';

/**
 * Interface defining seasonal rate modifier structure
 */
interface SeasonalModifier {
  startDate: Date;
  endDate: Date;
  adjustmentType: 'PERCENTAGE' | 'FIXED';
  adjustmentValue: number;
  description: string;
}

/**
 * Interface defining occupancy-based rate modifier structure
 */
interface OccupancyModifier {
  occupancyThreshold: number;
  adjustmentType: 'PERCENTAGE' | 'FIXED';
  adjustmentValue: number;
}

/**
 * Interface defining length of stay modifier structure
 */
interface LengthOfStayModifier {
  minimumNights: number;
  adjustmentType: 'PERCENTAGE' | 'FIXED';
  adjustmentValue: number;
}

/**
 * Interface defining channel-specific rules and adjustments
 */
interface ChannelRule {
  channelId: string;
  markup: number;
  minimumMarkup: number;
  rateParity: boolean;
  restrictions: {
    minimumLOS: number;
    maximumLOS: number;
    closedToArrival: boolean;
    closedToDeparture: boolean;
  };
}

/**
 * Enum defining different types of rates available in the system
 */
export enum RateType {
  RACK = 'RACK',
  CORPORATE = 'CORPORATE',
  GROUP = 'GROUP',
  PACKAGE = 'PACKAGE',
  PROMOTIONAL = 'PROMOTIONAL',
  SEASONAL = 'SEASONAL',
  DYNAMIC = 'DYNAMIC',
  CHANNEL_SPECIFIC = 'CHANNEL_SPECIFIC'
}

/**
 * Enum defining possible statuses for a rate
 */
export enum RateStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  SCHEDULED = 'SCHEDULED',
  PENDING_APPROVAL = 'PENDING_APPROVAL'
}

/**
 * Interface defining the structure of room rate records with comprehensive modifiers
 */
export interface Rate extends BaseModel {
  roomTypeId: UUID;
  rateCode: string;
  rateName: string;
  baseRate: number;
  taxRate: number;
  effectiveFrom: Date;
  effectiveTo: Date;
  type: RateType;
  status: RateStatus;
  seasonalModifiers: SeasonalModifier[];
  occupancyModifiers: OccupancyModifier[];
  lengthOfStayModifiers: LengthOfStayModifier[];
  applicableChannels: string[];
  isPromotional: boolean;
  minimumRate: number;
  maximumRate: number;
  channelRules: Record<string, ChannelRule>;
  currencyCode: string;
}

/**
 * Enhanced rate model with advanced calculation logic and channel management
 */
export class RateModel {
  private prisma: PrismaClient;
  private rateCache: Map<string, { rate: number; expiresAt: Date }>;

  constructor() {
    this.prisma = new PrismaClient();
    this.rateCache = new Map();
  }

  /**
   * Calculates final rate with all modifiers and channel rules
   * @param rateId - UUID of the rate to calculate
   * @param checkInDate - Check-in date for the stay
   * @param checkOutDate - Check-out date for the stay
   * @param occupancyPercentage - Current hotel occupancy percentage
   * @param channel - Distribution channel for the booking
   * @returns Promise resolving to final calculated rate
   */
  async calculateRate(
    rateId: UUID,
    checkInDate: Date,
    checkOutDate: Date,
    occupancyPercentage: number,
    channel: string
  ): Promise<number> {
    // Generate cache key
    const cacheKey = `${rateId}-${checkInDate}-${checkOutDate}-${occupancyPercentage}-${channel}`;
    
    // Check cache first
    const cachedRate = this.rateCache.get(cacheKey);
    if (cachedRate && cachedRate.expiresAt > new Date()) {
      return cachedRate.rate;
    }

    // Fetch base rate record
    const rate = await this.prisma.rate.findUnique({
      where: { id: rateId }
    }) as Rate;

    if (!rate || rate.status !== RateStatus.ACTIVE) {
      throw new Error('Rate not found or inactive');
    }

    let finalRate = rate.baseRate;

    // Apply seasonal modifiers
    const seasonalModifier = this.calculateSeasonalModifier(rate, checkInDate, checkOutDate);
    finalRate *= (1 + seasonalModifier);

    // Apply occupancy-based modifiers
    const occupancyModifier = this.calculateOccupancyModifier(rate, occupancyPercentage);
    finalRate *= (1 + occupancyModifier);

    // Apply length of stay modifiers
    const lengthOfStay = dayjs(checkOutDate).diff(dayjs(checkInDate), 'day');
    const losModifier = this.calculateLOSModifier(rate, lengthOfStay);
    finalRate *= (1 + losModifier);

    // Apply channel-specific rules
    if (channel && rate.channelRules[channel]) {
      const channelRule = rate.channelRules[channel];
      finalRate *= (1 + channelRule.markup);
      
      // Ensure channel minimum markup
      const minimumChannelRate = rate.baseRate * (1 + channelRule.minimumMarkup);
      finalRate = Math.max(finalRate, minimumChannelRate);
    }

    // Enforce rate bounds
    finalRate = Math.max(rate.minimumRate, Math.min(finalRate, rate.maximumRate));

    // Add tax
    finalRate *= (1 + rate.taxRate);

    // Cache the calculated rate for 15 minutes
    this.rateCache.set(cacheKey, {
      rate: finalRate,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    return Number(finalRate.toFixed(2));
  }

  /**
   * Calculates seasonal modifier based on date range
   */
  private calculateSeasonalModifier(rate: Rate, checkIn: Date, checkOut: Date): number {
    let modifier = 0;
    
    for (const seasonal of rate.seasonalModifiers) {
      if (dayjs(checkIn).isBetween(seasonal.startDate, seasonal.endDate, 'day', '[]') ||
          dayjs(checkOut).isBetween(seasonal.startDate, seasonal.endDate, 'day', '[]')) {
        if (seasonal.adjustmentType === 'PERCENTAGE') {
          modifier += seasonal.adjustmentValue / 100;
        } else {
          modifier += seasonal.adjustmentValue / rate.baseRate;
        }
      }
    }
    
    return modifier;
  }

  /**
   * Calculates occupancy-based modifier
   */
  private calculateOccupancyModifier(rate: Rate, occupancy: number): number {
    let modifier = 0;
    
    for (const occupancyMod of rate.occupancyModifiers) {
      if (occupancy >= occupancyMod.occupancyThreshold) {
        if (occupancyMod.adjustmentType === 'PERCENTAGE') {
          modifier += occupancyMod.adjustmentValue / 100;
        } else {
          modifier += occupancyMod.adjustmentValue / rate.baseRate;
        }
      }
    }
    
    return modifier;
  }

  /**
   * Calculates length of stay modifier
   */
  private calculateLOSModifier(rate: Rate, nights: number): number {
    let modifier = 0;
    
    for (const losMod of rate.lengthOfStayModifiers) {
      if (nights >= losMod.minimumNights) {
        if (losMod.adjustmentType === 'PERCENTAGE') {
          modifier += losMod.adjustmentValue / 100;
        } else {
          modifier += losMod.adjustmentValue / rate.baseRate;
        }
      }
    }
    
    return modifier;
  }
}