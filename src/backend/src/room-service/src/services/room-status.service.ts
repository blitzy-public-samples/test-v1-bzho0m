/**
 * @fileoverview Service responsible for managing room status transitions, validations,
 * real-time status updates, and maintaining detailed audit trails in the hotel management system.
 * @version 1.0.0
 */

// External imports
import { Injectable } from '@nestjs/common'; // v10.0.0
import { Observable, Subject, BehaviorSubject } from 'rxjs'; // v7.8.0
import { map, tap, catchError } from 'rxjs/operators';
import { Logger } from 'winston'; // v3.11.0

// Internal imports
import { BaseService } from '../../../shared/interfaces/base-service.interface';
import { RoomModel, RoomStatus } from '../models/room.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Interface for room status transition audit metadata
 */
interface AuditMetadata {
  userId: string;
  timestamp: Date;
  reason: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  notes?: string;
}

/**
 * Interface for room status change events
 */
interface RoomStatusChange {
  roomNumber: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  timestamp: Date;
  metadata: AuditMetadata;
}

/**
 * Interface for maintenance schedule
 */
interface MaintenanceSchedule {
  startTime: Date;
  endTime: Date;
  type: 'REGULAR' | 'EMERGENCY' | 'PREVENTIVE';
  assignedTo?: string;
}

/**
 * Enum for status transition reasons
 */
export enum StatusTransitionReason {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  MAINTENANCE_REQUIRED = 'MAINTENANCE_REQUIRED',
  MAINTENANCE_COMPLETE = 'MAINTENANCE_COMPLETE',
  CLEANING_REQUIRED = 'CLEANING_REQUIRED',
  CLEANING_COMPLETE = 'CLEANING_COMPLETE',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  BACK_IN_SERVICE = 'BACK_IN_SERVICE',
  EMERGENCY_MAINTENANCE = 'EMERGENCY_MAINTENANCE',
  SCHEDULED_MAINTENANCE = 'SCHEDULED_MAINTENANCE',
  DEEP_CLEANING = 'DEEP_CLEANING',
  INSPECTION_REQUIRED = 'INSPECTION_REQUIRED'
}

/**
 * Interface for status transition request
 */
interface StatusTransitionRequest {
  roomNumber: string;
  currentStatus: RoomStatus;
  newStatus: RoomStatus;
  reason: StatusTransitionReason;
  userId: string;
  timestamp: Date;
  businessHoursCheck: boolean;
  maintenanceSchedule?: MaintenanceSchedule;
  auditMetadata?: Partial<AuditMetadata>;
}

/**
 * Service handling room status management with advanced validation and real-time updates
 */
@Injectable()
export class RoomStatusService implements BaseService<RoomModel> {
  private readonly statusChangeSubject = new Subject<RoomStatusChange>();
  private readonly roomStatusCache = new BehaviorSubject<Map<string, RoomStatus>>(new Map());
  private readonly statusTransitionMatrix: Map<RoomStatus, Set<RoomStatus>>;

  constructor(
    private readonly logger: Logger,
    private readonly prisma: any,
    private readonly configService: any
  ) {
    this.initializeStatusTransitionMatrix();
    this.initializeRoomStatusCache();
  }

  /**
   * Initialize valid status transitions matrix
   */
  private initializeStatusTransitionMatrix(): void {
    this.statusTransitionMatrix = new Map([
      [RoomStatus.AVAILABLE, new Set([RoomStatus.OCCUPIED, RoomStatus.MAINTENANCE, RoomStatus.CLEANING, RoomStatus.BLOCKED])],
      [RoomStatus.OCCUPIED, new Set([RoomStatus.CLEANING, RoomStatus.MAINTENANCE])],
      [RoomStatus.CLEANING, new Set([RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE, RoomStatus.INSPECTING])],
      [RoomStatus.MAINTENANCE, new Set([RoomStatus.AVAILABLE, RoomStatus.OUT_OF_ORDER, RoomStatus.CLEANING])],
      [RoomStatus.OUT_OF_ORDER, new Set([RoomStatus.MAINTENANCE, RoomStatus.AVAILABLE])],
      [RoomStatus.BLOCKED, new Set([RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE])],
      [RoomStatus.INSPECTING, new Set([RoomStatus.AVAILABLE, RoomStatus.CLEANING, RoomStatus.MAINTENANCE])],
      [RoomStatus.DEEP_CLEANING, new Set([RoomStatus.INSPECTING, RoomStatus.CLEANING])]
    ]);
  }

  /**
   * Initialize room status cache from database
   */
  private async initializeRoomStatusCache(): Promise<void> {
    try {
      const rooms = await this.prisma.room.findMany({
        select: { roomNumber: true, status: true }
      });
      const statusMap = new Map(rooms.map(room => [room.roomNumber, room.status]));
      this.roomStatusCache.next(statusMap);
    } catch (error) {
      this.logger.error('Failed to initialize room status cache', { error });
      throw new Error(ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Observable stream of room status changes
   */
  public get statusChanges$(): Observable<RoomStatusChange> {
    return this.statusChangeSubject.asObservable();
  }

  /**
   * Validate status transition
   */
  public validateStatusTransition(
    currentStatus: RoomStatus,
    newStatus: RoomStatus,
    request: StatusTransitionRequest
  ): boolean {
    // Check if transition is allowed in matrix
    if (!this.statusTransitionMatrix.get(currentStatus)?.has(newStatus)) {
      this.logger.warn('Invalid status transition attempted', {
        currentStatus,
        newStatus,
        roomNumber: request.roomNumber
      });
      return false;
    }

    // Validate business hours for non-emergency transitions
    if (request.businessHoursCheck && !this.isWithinBusinessHours()) {
      return false;
    }

    // Validate maintenance schedule if applicable
    if (newStatus === RoomStatus.MAINTENANCE && !this.validateMaintenanceSchedule(request.maintenanceSchedule)) {
      return false;
    }

    return true;
  }

  /**
   * Update room status with validation and notifications
   */
  public async updateStatus(request: StatusTransitionRequest): Promise<Observable<RoomModel>> {
    try {
      // Validate transition
      if (!this.validateStatusTransition(request.currentStatus, request.newStatus, request)) {
        throw new Error(ErrorCode.INVALID_OPERATION);
      }

      // Update database
      const updatedRoom = await this.prisma.room.update({
        where: { roomNumber: request.roomNumber },
        data: {
          status: request.newStatus,
          lastUpdated: request.timestamp,
          statusHistory: {
            create: {
              previousStatus: request.currentStatus,
              newStatus: request.newStatus,
              reason: request.reason,
              userId: request.userId,
              timestamp: request.timestamp
            }
          }
        }
      });

      // Update cache
      const currentCache = this.roomStatusCache.value;
      currentCache.set(request.roomNumber, request.newStatus);
      this.roomStatusCache.next(currentCache);

      // Emit status change event
      const statusChange: RoomStatusChange = {
        roomNumber: request.roomNumber,
        previousStatus: request.currentStatus,
        newStatus: request.newStatus,
        timestamp: request.timestamp,
        metadata: {
          userId: request.userId,
          timestamp: request.timestamp,
          reason: request.reason,
          previousStatus: request.currentStatus,
          newStatus: request.newStatus,
          notes: request.auditMetadata?.notes
        }
      };
      this.statusChangeSubject.next(statusChange);

      // Log status change
      this.logger.info('Room status updated successfully', { statusChange });

      return new Observable<RoomModel>(subscriber => {
        subscriber.next(updatedRoom);
        subscriber.complete();
      });
    } catch (error) {
      this.logger.error('Failed to update room status', { error, request });
      throw error;
    }
  }

  /**
   * Check if operation is within business hours
   */
  private isWithinBusinessHours(): boolean {
    const now = new Date();
    const businessHours = this.configService.get('businessHours');
    const currentHour = now.getHours();
    return currentHour >= businessHours.start && currentHour < businessHours.end;
  }

  /**
   * Validate maintenance schedule
   */
  private validateMaintenanceSchedule(schedule?: MaintenanceSchedule): boolean {
    if (!schedule) return false;
    
    const now = new Date();
    return schedule.startTime >= now && schedule.endTime > schedule.startTime;
  }
}