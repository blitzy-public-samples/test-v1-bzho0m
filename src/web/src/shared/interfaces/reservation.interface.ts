/**
 * @fileoverview Reservation interfaces and types for hotel management system frontend
 * @description Defines comprehensive TypeScript interfaces for reservation-related data structures,
 * supporting digital check-in/out, service requests, folio management, and payment processing
 * @version 1.0.0
 */

// External imports
import { UUID } from 'crypto'; // v1.0.0

// Internal imports
import { Room, RoomType } from '../interfaces/room.interface';
import { Guest } from '../interfaces/guest.interface';

/**
 * Enum defining all possible reservation statuses
 */
export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  ON_HOLD = 'ON_HOLD',
  WAITING_LIST = 'WAITING_LIST'
}

/**
 * Enum defining all possible payment states for reservations
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  FAILED = 'FAILED',
  DECLINED = 'DECLINED',
  VOIDED = 'VOIDED'
}

/**
 * Comprehensive interface defining a reservation entity with all required
 * booking, payment, and service details
 */
export interface Reservation {
  /** Unique identifier for the reservation */
  id: UUID;
  
  /** Associated guest identifier */
  guestId: UUID;
  
  /** Assigned room number */
  roomNumber: string;
  
  /** Check-in date and time */
  checkInDate: Date;
  
  /** Check-out date and time */
  checkOutDate: Date;
  
  /** Current reservation status */
  status: ReservationStatus;
  
  /** Number of guests for the reservation */
  numberOfGuests: number;
  
  /** Total amount for the reservation */
  totalAmount: number;
  
  /** Current payment status */
  paymentStatus: PaymentStatus;
  
  /** Array of special requests for the reservation */
  specialRequests: string[];
  
  /** Timestamp when reservation was created */
  createdAt: Date;
  
  /** Timestamp of last update */
  updatedAt: Date;
  
  /** Timestamp of cancellation if applicable */
  cancelledAt: Date | null;
  
  /** Reason for cancellation if applicable */
  cancellationReason: string | null;
}

/**
 * Interface defining detailed rate information for a reservation
 * including taxes and adjustments
 */
export interface ReservationRate {
  /** Unique identifier for the rate entry */
  id: UUID;
  
  /** Associated reservation identifier */
  reservationId: UUID;
  
  /** Date for which this rate applies */
  date: Date;
  
  /** Base room rate amount */
  baseRate: number;
  
  /** Tax rate percentage */
  taxRate: number;
  
  /** Total rate including taxes and adjustments */
  totalRate: number;
  
  /** Amount of any rate adjustments */
  adjustmentAmount: number;
  
  /** Reason for rate adjustment */
  adjustmentReason: string;
}

/**
 * Interface for tracking additional services and charges
 */
export interface ReservationCharge {
  /** Unique identifier for the charge */
  id: UUID;
  
  /** Associated reservation identifier */
  reservationId: UUID;
  
  /** Type of charge (room service, amenity, etc.) */
  chargeType: string;
  
  /** Amount of the charge */
  amount: number;
  
  /** Description of the charge */
  description: string;
  
  /** Timestamp when charge was added */
  chargedAt: Date;
  
  /** Status of charge payment */
  paymentStatus: PaymentStatus;
}

/**
 * Interface for managing reservation modifications
 */
export interface ReservationModification {
  /** Unique identifier for the modification */
  id: UUID;
  
  /** Associated reservation identifier */
  reservationId: UUID;
  
  /** Type of modification made */
  modificationType: string;
  
  /** Previous value before modification */
  previousValue: any;
  
  /** New value after modification */
  newValue: any;
  
  /** User who made the modification */
  modifiedBy: string;
  
  /** Timestamp of modification */
  modifiedAt: Date;
  
  /** Reason for modification */
  reason: string;
}

/**
 * Type guard to check if an object implements the Reservation interface
 * @param obj - Object to check
 * @returns boolean indicating if object implements Reservation interface
 */
export function isReservation(obj: any): obj is Reservation {
  return obj
    && typeof obj.id === 'string'
    && typeof obj.guestId === 'string'
    && typeof obj.roomNumber === 'string'
    && obj.checkInDate instanceof Date
    && obj.checkOutDate instanceof Date
    && Object.values(ReservationStatus).includes(obj.status)
    && Object.values(PaymentStatus).includes(obj.paymentStatus);
}

/**
 * Type guard to check if an object implements the ReservationRate interface
 * @param obj - Object to check
 * @returns boolean indicating if object implements ReservationRate interface
 */
export function isReservationRate(obj: any): obj is ReservationRate {
  return obj
    && typeof obj.id === 'string'
    && typeof obj.reservationId === 'string'
    && obj.date instanceof Date
    && typeof obj.baseRate === 'number'
    && typeof obj.totalRate === 'number';
}