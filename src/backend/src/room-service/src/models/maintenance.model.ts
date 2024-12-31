/**
 * @fileoverview Defines the maintenance model for tracking and managing room maintenance requests 
 * and activities in the hotel management system with enhanced cost tracking, scheduling, and 
 * documentation capabilities.
 * @version 1.0.0
 */

// External imports
import { Prisma } from '@prisma/client'; // v5.0.0 - ORM and type definitions

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';
import { RoomModel } from './room.model';

/**
 * Enum defining the possible states of a maintenance request
 * Used for tracking the lifecycle of maintenance tasks
 */
export enum MaintenanceStatus {
  /** Initial state when request is created */
  PENDING = 'PENDING',
  /** Work has started on the maintenance task */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Maintenance work has been finished */
  COMPLETED = 'COMPLETED',
  /** Request has been cancelled */
  CANCELLED = 'CANCELLED',
  /** Work has been postponed */
  DEFERRED = 'DEFERRED'
}

/**
 * Enum defining priority levels for maintenance requests
 * Used for task prioritization and resource allocation
 */
export enum MaintenancePriority {
  /** Non-urgent maintenance that can be scheduled flexibly */
  LOW = 'LOW',
  /** Standard priority for routine maintenance */
  MEDIUM = 'MEDIUM',
  /** Important tasks requiring prompt attention */
  HIGH = 'HIGH',
  /** Critical issues requiring immediate attention */
  URGENT = 'URGENT'
}

/**
 * Interface defining the structure of maintenance records with comprehensive tracking capabilities
 * Extends BaseModel to inherit standard fields
 * @extends BaseModel
 */
export interface MaintenanceModel extends BaseModel {
  /**
   * Reference to the room requiring maintenance
   * @type {UUID}
   */
  roomId: UUID;

  /**
   * Detailed description of the maintenance issue or task
   * @type {string}
   */
  description: string;

  /**
   * Current status of the maintenance request
   * @type {MaintenanceStatus}
   * @default MaintenanceStatus.PENDING
   */
  status: MaintenanceStatus;

  /**
   * Priority level of the maintenance task
   * @type {MaintenancePriority}
   * @default MaintenancePriority.MEDIUM
   */
  priority: MaintenancePriority;

  /**
   * Planned date for maintenance execution
   * @type {Date}
   */
  scheduledDate: Date;

  /**
   * Actual completion date of maintenance
   * @type {Date | null}
   */
  completedDate: Date | null;

  /**
   * Staff member or contractor assigned to the task
   * @type {string}
   */
  assignedTo: string;

  /**
   * Additional notes or comments about the maintenance
   * @type {string | null}
   */
  notes: string | null;

  /**
   * Projected cost of maintenance work
   * @type {Prisma.Decimal}
   */
  estimatedCost: Prisma.Decimal;

  /**
   * Final cost after completion
   * @type {Prisma.Decimal | null}
   */
  actualCost: Prisma.Decimal | null;

  /**
   * Indicates if this is a recurring maintenance task
   * @type {boolean}
   * @default false
   */
  isRecurring: boolean;

  /**
   * Array of file paths or URLs for related documents
   * @type {string[]}
   * @default []
   */
  attachments: string[];
}

/**
 * Type definition for maintenance creation without system-managed fields
 * Used for creating new maintenance requests
 */
export type CreateMaintenanceDTO = Omit<MaintenanceModel, keyof BaseModel>;

/**
 * Type definition for maintenance update operations
 * Supports partial updates while maintaining type safety
 */
export type UpdateMaintenanceDTO = Partial<CreateMaintenanceDTO>;

/**
 * Type definition for maintenance query filters
 * Supports complex maintenance search and filtering operations
 */
export type MaintenanceQueryFilters = {
  status?: MaintenanceStatus[];
  priority?: MaintenancePriority[];
  roomId?: UUID;
  assignedTo?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  isRecurring?: boolean;
  costRange?: {
    min?: number;
    max?: number;
  };
};