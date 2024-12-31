/**
 * @fileoverview Defines the comprehensive room model for hotel room inventory management
 * with support for real-time operations, dynamic pricing, and multi-channel distribution.
 * Implements enhanced tracking capabilities for room status, maintenance, and cleaning schedules.
 * @version 1.0.0
 */

// External imports
import { Prisma } from '@prisma/client'; // v5.0.0 - ORM and type definitions

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';

/**
 * Enum defining comprehensive room status tracking with support for detailed operational states
 * Used for real-time inventory management and housekeeping coordination
 */
export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',         // Room is clean and ready for occupancy
  OCCUPIED = 'OCCUPIED',          // Room is currently in use by guests
  CLEANING = 'CLEANING',          // Room is being serviced by housekeeping
  MAINTENANCE = 'MAINTENANCE',     // Room is under maintenance
  OUT_OF_ORDER = 'OUT_OF_ORDER',  // Room is not available for extended period
  RESERVED = 'RESERVED',          // Room is booked for future arrival
  BLOCKED = 'BLOCKED',            // Room is administratively blocked
  INSPECTING = 'INSPECTING',      // Room is under quality inspection
  DEEP_CLEANING = 'DEEP_CLEANING' // Room is undergoing thorough cleaning
}

/**
 * Enum defining various room categories supporting diverse property configurations
 * Used for inventory segmentation and rate management
 */
export enum RoomType {
  STANDARD = 'STANDARD',           // Basic room configuration
  DELUXE = 'DELUXE',              // Enhanced room with additional amenities
  SUITE = 'SUITE',                // Larger room with separate living area
  EXECUTIVE = 'EXECUTIVE',         // Premium room with business facilities
  PRESIDENTIAL = 'PRESIDENTIAL',   // Highest category luxury accommodation
  ACCESSIBLE = 'ACCESSIBLE',       // ADA compliant room
  CONNECTING = 'CONNECTING',       // Rooms with connecting doors
  OCEAN_VIEW = 'OCEAN_VIEW',       // Rooms with ocean views
  CITY_VIEW = 'CITY_VIEW'         // Rooms with city views
}

/**
 * Enum defining detailed room amenities and features
 * Used for room categorization and guest preferences matching
 */
export enum RoomAmenities {
  WIFI = 'WIFI',                   // High-speed internet access
  TV = 'TV',                       // Television
  MINI_BAR = 'MINI_BAR',          // In-room refreshments
  SAFE = 'SAFE',                   // Security safe
  COFFEE_MAKER = 'COFFEE_MAKER',   // Coffee/tea facilities
  BALCONY = 'BALCONY',            // Private outdoor space
  OCEAN_VIEW = 'OCEAN_VIEW',       // Ocean viewing window/balcony
  CITY_VIEW = 'CITY_VIEW',        // City viewing window/balcony
  BATHTUB = 'BATHTUB',            // Full bathtub
  WORK_DESK = 'WORK_DESK',        // Business workspace
  KING_BED = 'KING_BED',          // King size bed
  TWIN_BEDS = 'TWIN_BEDS',        // Two twin beds
  SMART_TV = 'SMART_TV',          // Smart TV with streaming
  AIR_CONDITIONING = 'AIR_CONDITIONING', // Climate control
  ROOM_SERVICE = 'ROOM_SERVICE',   // In-room dining availability
  SOUNDPROOF = 'SOUNDPROOF'       // Enhanced sound insulation
}

/**
 * Interface defining maintenance history record structure
 */
interface MaintenanceHistory {
  records: Array<{
    date: Date;
    type: string;
    description: string;
    performedBy: string;
    cost?: number;
    nextScheduled?: Date;
  }>;
}

/**
 * Interface defining cleaning schedule record structure
 */
interface CleaningSchedule {
  regular: Array<{
    day: string;
    shift: string;
    assignedTo?: string;
  }>;
  deep: Array<{
    date: Date;
    assignedTo?: string;
    completed?: boolean;
  }>;
}

/**
 * Comprehensive room model interface extending BaseModel
 * Implements complete room management capabilities with enhanced tracking
 * @extends BaseModel
 */
export interface RoomModel extends BaseModel {
  /** Unique room identifier within the property */
  roomNumber: string;
  
  /** Room category classification */
  type: RoomType;
  
  /** Current operational status */
  status: RoomStatus;
  
  /** Physical floor location */
  floor: number;
  
  /** Standard rate for the room category */
  baseRate: Prisma.Decimal;
  
  /** Dynamic rate based on demand/season */
  currentRate: Prisma.Decimal;
  
  /** Available features and amenities */
  amenities: RoomAmenities[];
  
  /** Maximum allowed occupants */
  maxOccupancy: number;
  
  /** ADA compliance indicator */
  isAccessible: boolean;
  
  /** Detailed room description */
  description: string;
  
  /** Room photos/virtual tour links */
  images: string[];
  
  /** Maintenance tracking records */
  maintenanceHistory: MaintenanceHistory;
  
  /** Cleaning schedule and history */
  cleaningSchedule: CleaningSchedule;
  
  /** Availability status for booking */
  isActive: boolean;
  
  /** Last cleaning staff identifier */
  lastCleanedBy: string;
  
  /** Last cleaning timestamp */
  lastCleanedAt: Date;
  
  /** Additional room notes/comments */
  notes: string;
}

/**
 * Type definition for room creation without system-managed fields
 * Used for initial room setup and inventory addition
 */
export type CreateRoomDTO = Omit<RoomModel, keyof BaseModel>;

/**
 * Type definition for room update operations
 * Supports partial updates while maintaining type safety
 */
export type UpdateRoomDTO = Partial<CreateRoomDTO>;

/**
 * Type definition for room query filters
 * Supports complex room search and filtering operations
 */
export type RoomQueryFilters = {
  status?: RoomStatus[];
  type?: RoomType[];
  floor?: number[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  amenities?: RoomAmenities[];
  isAccessible?: boolean;
  isActive?: boolean;
};