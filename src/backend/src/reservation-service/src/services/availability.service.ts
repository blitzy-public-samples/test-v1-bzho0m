/**
 * @fileoverview Implements comprehensive room availability management with real-time inventory tracking,
 * dynamic pricing, and multi-channel distribution support. Handles availability rules, occupancy prediction,
 * and rate optimization with robust caching and validation.
 * @version 1.0.0
 */

// External imports
import { Observable, Subject, from, of } from 'rxjs'; // v7.8.0
import { map, catchError, tap } from 'rxjs/operators';
import dayjs from 'dayjs'; // v1.11.0
import { createClient } from 'redis'; // v4.6.0

// Internal imports
import { BaseService } from '../../../shared/interfaces/base-service.interface';
import { Booking, BookingStatus } from '../models/booking.model';
import { RoomModel, RoomStatus, RoomType } from '../../../room-service/src/models/room.model';
import { Rate, RateStatus } from '../models/rate.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Interface defining availability search criteria
 */
interface AvailabilityFilter {
  startDate: Date;
  endDate: Date;
  roomType?: RoomType;
  guests?: number;
  rateCode?: string;
  amenities?: string[];
  includeMaintenanceBlocks?: boolean;
}

/**
 * Interface defining availability search results
 */
interface AvailabilityResult {
  roomId: string;
  roomNumber: string;
  roomType: RoomType;
  baseRate: number;
  dynamicRate: number;
  isAvailable: boolean;
  unavailableDates: string[];
  maintenanceBlocks?: {
    startDate: Date;
    endDate: Date;
    reason: string;
  }[];
  amenities: string[];
}

/**
 * Interface for real-time availability updates
 */
interface AvailabilityUpdate {
  roomId: string;
  status: RoomStatus;
  timestamp: Date;
  reason?: string;
}

/**
 * Interface for occupancy metrics and predictions
 */
interface OccupancyMetrics {
  currentOccupancy: number;
  predictedOccupancy: number;
  revenueOptimization: {
    suggestedRates: Map<RoomType, number>;
    potentialRevenue: number;
  };
}

/**
 * Service implementing comprehensive room availability management
 */
export class AvailabilityService implements BaseService<AvailabilityResult> {
  private readonly availabilityStream: Subject<AvailabilityUpdate>;
  private readonly cacheClient: ReturnType<typeof createClient>;
  private readonly CACHE_TTL = 900; // 15 minutes in seconds

  constructor(
    private readonly bookingModel: typeof Booking,
    private readonly roomModel: typeof RoomModel,
    private readonly rateModel: typeof Rate
  ) {
    this.availabilityStream = new Subject<AvailabilityUpdate>();
    this.cacheClient = createClient({
      url: process.env.REDIS_URL,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    this.initializeCache();
  }

  /**
   * Initializes Redis cache connection
   */
  private async initializeCache(): Promise<void> {
    try {
      await this.cacheClient.connect();
    } catch (error) {
      console.error('Cache initialization failed:', error);
    }
  }

  /**
   * Checks room availability with comprehensive validation and dynamic pricing
   */
  public checkAvailability(filter: AvailabilityFilter): Observable<AvailabilityResult[]> {
    const cacheKey = this.generateCacheKey(filter);

    return from(this.cacheClient.get(cacheKey)).pipe(
      map(async (cachedResult) => {
        if (cachedResult) {
          return JSON.parse(cachedResult);
        }

        const results = await this.performAvailabilityCheck(filter);
        await this.cacheClient.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(results));
        return results;
      }),
      catchError((error) => {
        console.error('Availability check failed:', error);
        throw new Error(ErrorCode.INTERNAL_SERVER_ERROR);
      })
    );
  }

  /**
   * Performs comprehensive availability check with all validation rules
   */
  private async performAvailabilityCheck(filter: AvailabilityFilter): Promise<AvailabilityResult[]> {
    const { startDate, endDate, roomType, guests } = filter;

    // Validate date range
    if (!this.isValidDateRange(startDate, endDate)) {
      throw new Error(ErrorCode.VALIDATION_ERROR);
    }

    // Get all rooms matching criteria
    const rooms = await this.roomModel.findAll({
      where: {
        type: roomType,
        status: RoomStatus.AVAILABLE,
        maxOccupancy: { gte: guests || 1 },
        isActive: true
      }
    });

    // Get existing bookings for date range
    const bookings = await this.bookingModel.findAll({
      where: {
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.PENDING_CONFIRMATION
          ]
        },
        checkInDate: { lte: endDate },
        checkOutDate: { gte: startDate }
      }
    });

    // Calculate availability for each room
    const availabilityResults = await Promise.all(
      rooms.map(async (room) => {
        const roomBookings = bookings.filter((b) => b.roomId === room.id);
        const unavailableDates = this.calculateUnavailableDates(roomBookings, startDate, endDate);
        
        // Calculate dynamic rate
        const baseRate = await this.rateModel.calculateRate(
          room.rateId,
          startDate,
          endDate,
          await this.getCurrentOccupancy(),
          'DIRECT'
        );

        return {
          roomId: room.id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          baseRate,
          dynamicRate: this.applyDynamicPricing(baseRate, await this.getCurrentOccupancy()),
          isAvailable: unavailableDates.length === 0,
          unavailableDates,
          maintenanceBlocks: filter.includeMaintenanceBlocks ? room.maintenanceHistory.records : undefined,
          amenities: room.amenities
        };
      })
    );

    return availabilityResults;
  }

  /**
   * Calculates and predicts occupancy rates with revenue optimization
   */
  public getOccupancyRate(startDate: Date, endDate: Date): Observable<OccupancyMetrics> {
    return from(this.calculateOccupancyMetrics(startDate, endDate)).pipe(
      map((metrics) => ({
        currentOccupancy: metrics.currentOccupancy,
        predictedOccupancy: metrics.predictedOccupancy,
        revenueOptimization: {
          suggestedRates: this.calculateOptimalRates(metrics),
          potentialRevenue: this.calculatePotentialRevenue(metrics)
        }
      })),
      catchError((error) => {
        console.error('Occupancy calculation failed:', error);
        throw new Error(ErrorCode.INTERNAL_SERVER_ERROR);
      })
    );
  }

  /**
   * Validates specific room availability with conflict checking
   */
  public validateAvailability(
    roomIds: string[],
    checkIn: Date,
    checkOut: Date
  ): Observable<boolean> {
    return from(this.performValidation(roomIds, checkIn, checkOut)).pipe(
      map((isValid) => isValid),
      catchError((error) => {
        console.error('Availability validation failed:', error);
        throw new Error(ErrorCode.INTERNAL_SERVER_ERROR);
      })
    );
  }

  /**
   * Generates cache key for availability results
   */
  private generateCacheKey(filter: AvailabilityFilter): string {
    return `availability:${dayjs(filter.startDate).format('YYYY-MM-DD')}:${
      dayjs(filter.endDate).format('YYYY-MM-DD')
    }:${filter.roomType || 'all'}:${filter.guests || 1}`;
  }

  /**
   * Validates date range for availability check
   */
  private isValidDateRange(startDate: Date, endDate: Date): boolean {
    return dayjs(startDate).isValid() &&
           dayjs(endDate).isValid() &&
           dayjs(startDate).isBefore(endDate) &&
           dayjs(startDate).isAfter(dayjs().startOf('day').subtract(1, 'day'));
  }

  /**
   * Calculates unavailable dates for a room
   */
  private calculateUnavailableDates(
    bookings: Booking[],
    startDate: Date,
    endDate: Date
  ): string[] {
    const unavailableDates: string[] = [];
    const currentDate = dayjs(startDate);
    const end = dayjs(endDate);

    while (currentDate.isBefore(end)) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const isBooked = bookings.some((booking) =>
        currentDate.isBetween(booking.checkInDate, booking.checkOutDate, 'day', '[]')
      );

      if (isBooked) {
        unavailableDates.push(dateStr);
      }
      currentDate.add(1, 'day');
    }

    return unavailableDates;
  }

  /**
   * Applies dynamic pricing based on occupancy
   */
  private applyDynamicPricing(baseRate: number, occupancy: number): number {
    const occupancyMultiplier = 1 + (Math.max(0, occupancy - 0.7) * 0.5);
    return Number((baseRate * occupancyMultiplier).toFixed(2));
  }

  /**
   * Calculates current occupancy percentage
   */
  private async getCurrentOccupancy(): Promise<number> {
    const [totalRooms, occupiedRooms] = await Promise.all([
      this.roomModel.count({ where: { isActive: true } }),
      this.roomModel.count({
        where: {
          status: RoomStatus.OCCUPIED,
          isActive: true
        }
      })
    ]);

    return totalRooms > 0 ? occupiedRooms / totalRooms : 0;
  }

  /**
   * Performs detailed availability validation
   */
  private async performValidation(
    roomIds: string[],
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    const rooms = await this.roomModel.findAll({
      where: {
        id: { in: roomIds },
        isActive: true
      }
    });

    if (rooms.length !== roomIds.length) {
      return false;
    }

    const bookings = await this.bookingModel.findAll({
      where: {
        roomId: { in: roomIds },
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.PENDING_CONFIRMATION
          ]
        },
        checkInDate: { lte: checkOut },
        checkOutDate: { gte: checkIn }
      }
    });

    return bookings.length === 0;
  }
}