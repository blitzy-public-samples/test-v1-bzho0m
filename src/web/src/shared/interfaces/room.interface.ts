/**
 * @file Room interfaces and types for hotel management system frontend
 * @description Defines TypeScript interfaces and types for room-related data structures,
 * supporting real-time inventory, dynamic pricing, and multi-channel distribution
 * @version 1.0.0
 */

/**
 * Enum representing possible states of a room
 */
export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  RESERVED = 'RESERVED',
  BLOCKED = 'BLOCKED'
}

/**
 * Enum representing different types of rooms available
 */
export enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  SUITE = 'SUITE',
  EXECUTIVE = 'EXECUTIVE',
  PRESIDENTIAL = 'PRESIDENTIAL',
  ACCESSIBLE = 'ACCESSIBLE'
}

/**
 * Enum representing available amenities in rooms
 */
export enum RoomAmenities {
  WIFI = 'WIFI',
  TV = 'TV',
  MINI_BAR = 'MINI_BAR',
  SAFE = 'SAFE',
  COFFEE_MAKER = 'COFFEE_MAKER',
  BALCONY = 'BALCONY',
  OCEAN_VIEW = 'OCEAN_VIEW',
  CITY_VIEW = 'CITY_VIEW',
  BATHTUB = 'BATHTUB',
  WORK_DESK = 'WORK_DESK',
  KING_BED = 'KING_BED',
  TWIN_BEDS = 'TWIN_BEDS'
}

/**
 * Enum representing available distribution channels for room inventory
 */
export enum DistributionChannel {
  DIRECT = 'DIRECT',
  OTA = 'OTA',
  GDS = 'GDS',
  CORPORATE = 'CORPORATE',
  WHOLESALE = 'WHOLESALE',
  MOBILE_APP = 'MOBILE_APP'
}

/**
 * Interface defining price adjustment factors for dynamic pricing
 */
export interface PriceAdjustmentFactor {
  factor: string;
  value: number;
  weight: number;
}

/**
 * Interface for channel-specific restriction rules
 */
export interface ChannelRestrictionRule {
  type: string;
  value: any;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Interface for distribution channel restrictions
 */
export interface ChannelRestriction {
  /** Distribution channel identifier */
  channel: DistributionChannel;
  /** Whether channel is enabled for this room */
  isEnabled: boolean;
  /** Specific rules for this channel */
  restrictions: ChannelRestrictionRule[];
}

/**
 * Interface for dynamic pricing configuration
 */
export interface PricingStrategy {
  /** Type of pricing strategy being applied */
  strategyType: string;
  /** Factors affecting price adjustment */
  adjustmentFactors: PriceAdjustmentFactor[];
  /** Minimum allowed rate */
  minimumRate: number;
  /** Maximum allowed rate */
  maximumRate: number;
}

/**
 * Interface defining the structure of a room entity for frontend use
 */
export interface Room {
  /** Unique identifier for the room */
  id: string;
  /** Room number identifier */
  roomNumber: string;
  /** Type/category of the room */
  type: RoomType;
  /** Current status of the room */
  status: RoomStatus;
  /** Floor number where room is located */
  floor: number;
  /** Base price rate for the room */
  baseRate: number;
  /** Current dynamic rate based on pricing strategy */
  currentRate: number;
  /** List of amenities available in the room */
  amenities: RoomAmenities[];
  /** Maximum number of guests allowed */
  maxOccupancy: number;
  /** Indicates if room is handicap accessible */
  isAccessible: boolean;
  /** Detailed description of the room */
  description: string;
  /** Array of room image URLs */
  images: string[];
  /** Timestamp of last modification for real-time tracking */
  lastModified: Date;
  /** Distribution channel availability and restrictions */
  channelRestrictions: ChannelRestriction[];
  /** Current dynamic pricing strategy configuration */
  pricingStrategy: PricingStrategy;
}

/**
 * Interface for room availability status
 */
export interface RoomAvailability {
  /** Room identifier */
  roomId: string;
  /** Availability status */
  isAvailable: boolean;
  /** Next date room becomes available */
  nextAvailableDate: Date;
  /** Availability status per distribution channel */
  channelAvailability: Map<DistributionChannel, boolean>;
}