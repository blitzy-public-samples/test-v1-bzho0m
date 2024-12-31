/**
 * @fileoverview Enhanced housekeeping controller implementing REST API endpoints for housekeeping operations
 * with real-time updates, comprehensive validation, and business rules enforcement.
 * @version 1.0.0
 */

// External imports - v4.18.2
import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify'; // v6.1.0
import { controller, httpGet, httpPost, httpPut } from 'inversify-express-utils'; // v6.4.3

// Internal imports
import { BaseController, RequestWithUser, ApiResponse, PaginatedResponse } from '../../../shared/interfaces/base-controller.interface';
import { HousekeepingModel, HousekeepingStatus, HousekeepingType, HousekeepingQueryFilters, isInspectionDetails } from '../models/housekeeping.model';
import { RoomStatus } from '../models/room.model';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { HousekeepingService } from '../services/housekeeping.service';

/**
 * Enhanced controller implementing housekeeping operations REST API endpoints
 * with real-time updates and comprehensive validation
 */
@injectable()
@controller('/api/v1/housekeeping')
export class HousekeepingController implements BaseController<HousekeepingModel> {
  constructor(
    @inject('HousekeepingService') private housekeepingService: HousekeepingService
  ) {}

  /**
   * Creates a new housekeeping task with enhanced validation and business rules
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with created task or error
   */
  @httpPost('/')
  async create(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate required fields
      const { roomId, type, priority, scheduledStartTime } = req.body;
      if (!roomId || !type || !priority || !scheduledStartTime) {
        throw { code: ErrorCode.VALIDATION_ERROR, message: 'Missing required fields' };
      }

      // Validate task type
      if (!Object.values(HousekeepingType).includes(type)) {
        throw { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid housekeeping type' };
      }

      // Validate priority range (1-5)
      if (priority < 1 || priority > 5) {
        throw { code: ErrorCode.VALIDATION_ERROR, message: 'Priority must be between 1 and 5' };
      }

      // Create task with initial PENDING status
      const task = await this.housekeepingService.create({
        ...req.body,
        status: HousekeepingStatus.PENDING,
        assignedStaffId: req.user?.id,
        actualStartTime: null,
        completionTime: null
      }).toPromise();

      const response: ApiResponse<HousekeepingModel> = {
        success: true,
        data: task
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves all housekeeping tasks with comprehensive filtering
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with filtered tasks or error
   */
  @httpGet('/')
  async findAll(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract query parameters
      const filters: HousekeepingQueryFilters = {
        status: req.query.status as HousekeepingStatus[],
        type: req.query.type as HousekeepingType[],
        priority: req.query.priority ? JSON.parse(req.query.priority as string) : undefined,
        dateRange: req.query.dateRange ? JSON.parse(req.query.dateRange as string) : undefined,
        assignedStaffId: req.query.assignedStaffId as string,
        isInspectionRequired: req.query.isInspectionRequired === 'true'
      };

      // Pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const [tasks, total] = await Promise.all([
        this.housekeepingService.findAll(filters).toPromise(),
        this.housekeepingService.count(filters).toPromise()
      ]);

      const response: PaginatedResponse<HousekeepingModel> = {
        success: true,
        data: tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates housekeeping task with status transition validation
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with updated task or error
   */
  @httpPut('/:id')
  async update(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = req.params.id;
      const updates = req.body;

      // Validate task existence
      const existingTask = await this.housekeepingService.findById(taskId).toPromise();
      if (!existingTask) {
        throw { code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Housekeeping task not found' };
      }

      // Validate status transition
      if (updates.status) {
        await this.validateStatusTransition(existingTask.status, updates.status);
      }

      // Validate inspection details if provided
      if (updates.inspectionDetails && !isInspectionDetails(updates.inspectionDetails)) {
        throw { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid inspection details format' };
      }

      // Update timestamps based on status
      if (updates.status === HousekeepingStatus.IN_PROGRESS) {
        updates.actualStartTime = new Date();
      } else if (updates.status === HousekeepingStatus.COMPLETED) {
        updates.completionTime = new Date();
      }

      const updatedTask = await this.housekeepingService.update(taskId, updates).toPromise();

      const response: ApiResponse<HousekeepingModel> = {
        success: true,
        data: updatedTask
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validates housekeeping status transitions based on business rules
   * 
   * @param {HousekeepingStatus} currentStatus - Current task status
   * @param {HousekeepingStatus} newStatus - Requested new status
   * @throws {Error} If status transition is invalid
   */
  private async validateStatusTransition(
    currentStatus: HousekeepingStatus,
    newStatus: HousekeepingStatus
  ): Promise<void> {
    const validTransitions = {
      [HousekeepingStatus.PENDING]: [
        HousekeepingStatus.IN_PROGRESS,
        HousekeepingStatus.CANCELLED
      ],
      [HousekeepingStatus.IN_PROGRESS]: [
        HousekeepingStatus.COMPLETED,
        HousekeepingStatus.REQUIRES_ATTENTION
      ],
      [HousekeepingStatus.COMPLETED]: [
        HousekeepingStatus.INSPECTED,
        HousekeepingStatus.REQUIRES_ATTENTION
      ],
      [HousekeepingStatus.REQUIRES_ATTENTION]: [
        HousekeepingStatus.IN_PROGRESS
      ],
      [HousekeepingStatus.INSPECTED]: [
        HousekeepingStatus.REQUIRES_ATTENTION
      ]
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw {
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: `Invalid status transition from ${currentStatus} to ${newStatus}`
      };
    }
  }

  /**
   * Deletes a housekeeping task (soft delete)
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with deletion confirmation or error
   */
  async delete(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = req.params.id;

      // Validate task existence
      const existingTask = await this.housekeepingService.findById(taskId).toPromise();
      if (!existingTask) {
        throw { code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Housekeeping task not found' };
      }

      // Only allow deletion of PENDING or CANCELLED tasks
      if (![HousekeepingStatus.PENDING, HousekeepingStatus.CANCELLED].includes(existingTask.status)) {
        throw {
          code: ErrorCode.BUSINESS_RULE_VIOLATION,
          message: 'Only pending or cancelled tasks can be deleted'
        };
      }

      await this.housekeepingService.delete(taskId).toPromise();

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}