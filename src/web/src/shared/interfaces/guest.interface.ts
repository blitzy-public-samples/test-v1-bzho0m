/**
 * @fileoverview Guest-related interfaces for the Hotel Management ERP Front Office Module
 * @version 1.0.0
 * @license MIT
 */

// External imports
import { UUID } from 'crypto'; // v1.0.0

/**
 * Core interface defining the structure of guest data with comprehensive personal information
 * and metadata. Implements secure PII handling and data management requirements.
 * 
 * @interface Guest
 */
export interface Guest {
  /** Unique identifier for guest */
  id: UUID;
  
  /** Guest's first name */
  firstName: string;
  
  /** Guest's last name */
  lastName: string;
  
  /** Primary contact email */
  email: string;
  
  /** Contact phone number with international format support */
  phone: string;
  
  /** Street address */
  address: string;
  
  /** City of residence */
  city: string;
  
  /** State/province */
  state: string;
  
  /** Country of residence - ISO 3166-1 alpha-2 code */
  country: string;
  
  /** Postal/ZIP code */
  postalCode: string;
  
  /** Type of identification document (passport, national ID, etc.) */
  idType: string;
  
  /** Identification document number (encrypted at rest) */
  idNumber: string;
  
  /** Guest's date of birth */
  dateOfBirth: Date;
  
  /** Guest's nationality - ISO 3166-1 alpha-2 code */
  nationality: string;
  
  /** Preferred communication language - ISO 639-1 code */
  language: string;
  
  /** VIP classification level (standard, silver, gold, platinum) */
  vipStatus: string;
  
  /** Account status flag */
  isActive: boolean;
  
  /** Record creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Soft deletion timestamp */
  deletedAt: Date | null;
}

/**
 * Interface for managing detailed guest preferences and personalization settings.
 * Supports enhanced guest experience features and preference tracking.
 * 
 * @interface GuestPreference
 */
export interface GuestPreference {
  /** Unique preference identifier */
  id: UUID;
  
  /** Associated guest identifier */
  guestId: UUID;
  
  /** Preferred room category */
  roomType: string;
  
  /** Preferred floor level */
  floorLevel: number;
  
  /** Smoking preference */
  smokingRoom: boolean;
  
  /** Bed type preferences */
  bedType: string[];
  
  /** Pillow type preferences */
  pillowType: string[];
  
  /** Preferred room amenities */
  amenities: string[];
  
  /** Dietary requirements and restrictions */
  dietaryRestrictions: string[];
  
  /** Preferred room temperature (in Celsius) */
  temperature: string;
  
  /** Additional special requests and custom preferences */
  specialRequests: Record<string, any>;
}

/**
 * Secure interface for handling guest identification documents and sensitive information.
 * Implements PCI DSS and GDPR compliance requirements for document handling.
 * 
 * @interface GuestDocument
 */
export interface GuestDocument {
  /** Document type (passport, ID, etc.) */
  type: string;
  
  /** Document number (encrypted at rest) */
  number: string;
  
  /** Country of issue - ISO 3166-1 alpha-2 code */
  issuingCountry: string;
  
  /** Document expiration date */
  expiryDate: Date;
  
  /** Secure document storage reference URL */
  documentUrl: string;
}

/**
 * Type guard to check if an object implements the Guest interface
 * @param obj - Object to check
 * @returns boolean indicating if object implements Guest interface
 */
export function isGuest(obj: any): obj is Guest {
  return obj 
    && typeof obj.id === 'string'
    && typeof obj.firstName === 'string'
    && typeof obj.lastName === 'string'
    && typeof obj.email === 'string';
}

/**
 * Type guard to check if an object implements the GuestPreference interface
 * @param obj - Object to check
 * @returns boolean indicating if object implements GuestPreference interface
 */
export function isGuestPreference(obj: any): obj is GuestPreference {
  return obj
    && typeof obj.id === 'string'
    && typeof obj.guestId === 'string'
    && Array.isArray(obj.bedType)
    && Array.isArray(obj.amenities);
}

/**
 * Type guard to check if an object implements the GuestDocument interface
 * @param obj - Object to check
 * @returns boolean indicating if object implements GuestDocument interface
 */
export function isGuestDocument(obj: any): obj is GuestDocument {
  return obj
    && typeof obj.type === 'string'
    && typeof obj.number === 'string'
    && obj.expiryDate instanceof Date;
}