/**
 * @fileoverview Defines the comprehensive housekeeping model for managing room cleaning tasks,
 * schedules, and status tracking with enhanced inspection and priority management capabilities.
 * Implements detailed tracking of cleaning operations and quality control measures.
 * @version 1.0.0
 */

// External imports
import { Prisma } from '@prisma/client'; // v5.0.0

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';
import { RoomModel, RoomStatus } from './room.model';

/**
 * Enhanced enum for detailed housekeeping task status tracking
 * Supports comprehensive workflow states for cleaning operations
 */
export enum HousekeepingStatus {
  PENDING = 'PENDING',               // Task is scheduled but not started
  IN_PROGRESS = 'IN_PROGRESS',       // Task is currently being performed
  COMPLETED = 'COMPLETED',           // Task is finished but not inspected
  INSPECTED = 'INSPECTED',          // Task has passed quality inspection
  REQUIRES_ATTENTION = 'REQUIRES_ATTENTION', // Issues found during inspection
  CANCELLED = 'CANCELLED'           // Task was cancelled
}

/**
 * Extended enum for comprehensive housekeeping task types
 * Supports various cleaning service categories
 */
export enum HousekeepingType {
  DAILY_CLEANING = 'DAILY_CLEANING',     // Regular daily room service
  DEEP_CLEANING = 'DEEP_CLEANING',       // Thorough cleaning service
  TURNDOWN_SERVICE = 'TURNDOWN_SERVICE', // Evening preparation service
  POST_CHECKOUT = 'POST_CHECKOUT',       // Cleaning after guest departure
  VIP_PREPARATION = 'VIP_PREPARATION',   // Special preparation for VIP guests
  MAINTENANCE_CLEANUP = 'MAINTENANCE_CLEANUP' // Post-maintenance cleaning
}

/**
 * Interface for inspection details structure
 * Tracks quality control measures and findings
 */
interface InspectionDetails {
  inspector: string;
  inspectionDate?: Date;
  checklist: {
    item: string;
    status: 'PASS' | 'FAIL';
    comments?: string;
  }[];
  overallRating: number;
  followUpRequired: boolean;
  photos?: string[];
}

/**
 * Interface defining the comprehensive structure of housekeeping records
 * Implements enhanced inspection and priority management capabilities
 * @extends BaseModel
 */
export interface HousekeepingModel extends BaseModel {
  /** Associated room identifier */
  roomId: UUID;

  /** Current status of the housekeeping task */
  status: HousekeepingStatus;

  /** Type of housekeeping service */
  type: HousekeepingType;

  /** Staff member assigned to the task */
  assignedStaffId: UUID;

  /** Planned start time for the task */
  scheduledStartTime: Date;

  /** Actual task start time */
  actualStartTime: Date | null;

  /** Task completion time */
  completionTime: Date | null;

  /** List of specific cleaning tasks to be performed */
  tasks: string[];

  /** Additional notes or special instructions */
  notes: string | null;

  /** Task priority level (1-5, where 1 is highest) */
  priority: number;

  /** Indicates if quality inspection is required */
  isInspectionRequired: boolean;

  /** Detailed inspection information */
  inspectionDetails: Prisma.JsonValue;
}

/**
 * Type definition for housekeeping task creation
 * Excludes system-managed fields from BaseModel
 */
export type CreateHousekeepingDTO = Omit<HousekeepingModel, keyof BaseModel>;

/**
 * Type definition for housekeeping task updates
 * Supports partial updates while maintaining type safety
 */
export type UpdateHousekeepingDTO = Partial<CreateHousekeepingDTO>;

/**
 * Type definition for housekeeping task query filters
 * Supports complex task search and filtering operations
 */
export type HousekeepingQueryFilters = {
  status?: HousekeepingStatus[];
  type?: HousekeepingType[];
  priority?: number[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  assignedStaffId?: UUID;
  isInspectionRequired?: boolean;
  roomId?: UUID;
};

/**
 * Type guard to validate inspection details structure
 * @param value - Value to be validated as InspectionDetails
 */
export function isInspectionDetails(value: any): value is InspectionDetails {
  return (
    typeof value === 'object' &&
    typeof value.inspector === 'string' &&
    Array.isArray(value.checklist) &&
    typeof value.overallRating === 'number' &&
    typeof value.followUpRequired === 'boolean'
  );
}

/**
 * Type definition for housekeeping statistics
 * Provides aggregated metrics for housekeeping operations
 */
export interface HousekeepingStats {
  totalTasks: number;
  completedTasks: number;
  pendingInspections: number;
  averageCompletionTime: number;
  staffPerformance: {
    staffId: UUID;
    tasksCompleted: number;
    averageRating: number;
  }[];
}