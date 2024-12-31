/**
 * @fileoverview Implements the comprehensive booking model for hotel reservation management
 * with support for real-time inventory tracking, rate management, and booking lifecycle.
 * @version 1.0.0
 */

// External imports - v5.0.0
import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';  // v3.8.2
import { MetricsCollector } from '@opentelemetry/metrics'; // v1.12.0
import { UUID } from 'crypto';

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';

/**
 * Enum defining all possible booking statuses with comprehensive lifecycle tracking
 */
export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  ON_HOLD = 'ON_HOLD'
}

/**
 * Enum defining payment status tracking for bookings
 */
export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED'
}

/**
 * Interface defining the structure of booking audit trail entries
 */
interface AuditEntry {
  timestamp: Date;
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}

/**
 * Interface for special requests associated with bookings
 */
interface SpecialRequests {
  dietary?: string[];
  accessibility?: string[];
  roomPreferences?: string[];
  additionalServices?: string[];
  notes?: string;
}

/**
 * Comprehensive booking interface extending BaseModel
 */
export interface Booking extends BaseModel {
  guestId: UUID;
  roomId: UUID;
  rateId: UUID;
  bookingNumber: string;
  status: BookingStatus;
  checkInDate: Date;
  checkOutDate: Date;
  numberOfGuests: number;
  totalAmount: number;
  taxAmount: number;
  bookingSource: string;
  paymentStatus: PaymentStatus;
  specialRequests: SpecialRequests;
  isConfirmed: boolean;
  cancellationReason?: string;
  cancellationDate?: Date;
  cancellationFee?: number;
  auditTrail: AuditEntry[];
  lastModifiedBy: string;
}

/**
 * Options for transaction management in booking operations
 */
interface TransactionOptions {
  timeout?: number;
  maxRetries?: number;
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
}

/**
 * Implementation of the booking model with enhanced transaction support and validation
 */
export class BookingModel {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;

  constructor(logger: Logger, metrics: MetricsCollector) {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'minimal',
      connectionTimeout: 5000,
    });
    this.logger = logger;
    this.metrics = metrics;
  }

  /**
   * Creates a new booking with comprehensive validation and transaction support
   */
  async create(data: Omit<Booking, keyof BaseModel>, options?: TransactionOptions): Promise<Booking> {
    const startTime = Date.now();
    
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Validate room availability
        const room = await tx.room.findUnique({
          where: { id: data.roomId },
          select: { status: true, baseRate: true },
        });

        if (!room || room.status !== 'AVAILABLE') {
          throw new Error('Room not available for booking');
        }

        // Generate unique booking number
        const bookingNumber = await this.generateBookingNumber();

        // Create booking record with audit trail
        const booking = await tx.booking.create({
          data: {
            ...data,
            bookingNumber,
            status: BookingStatus.PENDING,
            paymentStatus: PaymentStatus.UNPAID,
            auditTrail: [{
              timestamp: new Date(),
              action: 'BOOKING_CREATED',
              userId: data.lastModifiedBy,
              changes: { status: 'PENDING' }
            }],
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        });

        // Update room status
        await tx.room.update({
          where: { id: data.roomId },
          data: { status: 'BOOKED' }
        });

        this.metrics.recordMetric('booking_creation_duration', Date.now() - startTime);
        this.logger.info(`Booking created successfully: ${bookingNumber}`);

        return booking;
      }, {
        timeout: options?.timeout || 5000,
        maxWait: 2000,
        isolation: options?.isolationLevel || 'ReadCommitted'
      });
    } catch (error) {
      this.logger.error('Error creating booking:', error);
      this.metrics.recordMetric('booking_creation_failures', 1);
      throw error;
    }
  }

  /**
   * Updates an existing booking with status transition validation
   */
  async update(id: UUID, data: Partial<Booking>, options?: TransactionOptions): Promise<Booking> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingBooking = await tx.booking.findUnique({
          where: { id }
        });

        if (!existingBooking) {
          throw new Error('Booking not found');
        }

        // Validate status transition
        if (data.status) {
          this.validateStatusTransition(existingBooking.status as BookingStatus, data.status as BookingStatus);
        }

        // Update booking with audit trail
        const updatedBooking = await tx.booking.update({
          where: { id },
          data: {
            ...data,
            updatedAt: new Date(),
            auditTrail: [
              ...(existingBooking.auditTrail as AuditEntry[]),
              {
                timestamp: new Date(),
                action: 'BOOKING_UPDATED',
                userId: data.lastModifiedBy,
                changes: data
              }
            ]
          }
        });

        this.logger.info(`Booking updated successfully: ${updatedBooking.bookingNumber}`);
        return updatedBooking;
      }, {
        timeout: options?.timeout || 5000,
        isolation: options?.isolationLevel || 'ReadCommitted'
      });
    } catch (error) {
      this.logger.error('Error updating booking:', error);
      throw error;
    }
  }

  /**
   * Validates booking status transitions
   */
  private validateStatusTransition(currentStatus: BookingStatus, newStatus: BookingStatus): void {
    const validTransitions = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
      [BookingStatus.CHECKED_OUT]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NO_SHOW]: [],
      [BookingStatus.PENDING_CONFIRMATION]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.PENDING_PAYMENT]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.ON_HOLD]: [BookingStatus.PENDING, BookingStatus.CANCELLED]
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Generates a unique booking number
   */
  private async generateBookingNumber(): Promise<string> {
    const prefix = 'BK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
}