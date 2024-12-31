/**
 * @fileoverview Defines the core base model interface that all database entities must implement
 * across microservices, providing standardized fields for entity lifecycle tracking, audit trails,
 * and consistent data structure management.
 * @version 1.0.0
 */

// External imports
import { UUID } from 'crypto'; // v18.0.0 - For UUID type definition

/**
 * Core interface that defines required fields and structure for all database entities across the system.
 * Must be implemented by all database entity models to ensure consistent data structure and lifecycle tracking.
 * 
 * @interface BaseModel
 * 
 * @example
 * interface Room extends BaseModel {
 *   roomNumber: string;
 *   // ... other room specific fields
 * }
 * 
 * @example
 * interface Guest extends BaseModel {
 *   firstName: string;
 *   // ... other guest specific fields
 * }
 */
export interface BaseModel {
  /**
   * Unique identifier for the entity using cryptographically secure UUID v4.
   * This field is immutable after creation.
   * 
   * @readonly
   * @type {UUID}
   * @format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  readonly id: UUID;

  /**
   * Timestamp when entity was created, automatically set on record creation.
   * Stored in UTC timezone.
   * 
   * @readonly
   * @type {Date}
   */
  readonly createdAt: Date;

  /**
   * Timestamp when entity was last updated, automatically updated on any changes.
   * Stored in UTC timezone.
   * 
   * @type {Date}
   */
  updatedAt: Date;

  /**
   * Timestamp when entity was soft deleted. Null indicates an active record.
   * Stored in UTC timezone when set.
   * 
   * @type {Date | null}
   * @optional
   */
  deletedAt?: Date | null;
}

/**
 * Type definition for UUID v4 string format used for entity IDs.
 * Must match the standard UUID v4 format pattern.
 */
export type UUID = string;