/**
 * @fileoverview Controller handling maintenance request operations for hotel rooms
 * with enhanced security, monitoring, and error handling capabilities.
 * @version 1.0.0
 */

// External imports - with versions
import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Delete, 
  Param, 
  Body, 
  UseGuards, 
  UseInterceptors,
  HttpException,
  Logger
} from '@nestjs/common'; // ^10.0.0
import { Request, Response } from 'express'; // ^4.18.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { Cache } from '@nestjs/cache-manager'; // ^2.0.0

// Internal imports
import { BaseController } from '../../../shared/interfaces/base-controller.interface';
import { MaintenanceModel, MaintenanceStatus, MaintenancePriority } from '../models/maintenance.model';
import { RoomStatusService } from '../services/room-status.service';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { RoomStatus } from '../models/room.model';

/**
 * Controller handling maintenance request operations with enhanced security and monitoring
 */
@Controller('maintenance')
@UseGuards(AuthGuard, RoleGuard)
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@RateLimit({ limit: 100, ttl: 60 })
export class MaintenanceController implements BaseController<MaintenanceModel> {
  private readonly logger = new Logger(MaintenanceController.name);

  constructor(
    private readonly roomStatusService: RoomStatusService,
    @Cache() private readonly cacheManager: CacheManager,
  ) {}

  /**
   * Creates a new maintenance request with enhanced validation and security
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Promise<MaintenanceModel>} Created maintenance request
   * @throws {HttpException} If validation fails or operation is invalid
   */
  @Post()
  @UseValidation(CreateMaintenanceDto)
  @Roles('maintenance_admin', 'facility_manager')
  @UseTransaction()
  async create(req: Request, res: Response): Promise<MaintenanceModel> {
    try {
      const { roomId, description, priority, scheduledDate, estimatedCost } = req.body;
      const userId = req.user.id;

      // Validate room exists and status transition is allowed
      const roomStatus = await this.roomStatusService.validateStatusTransition(
        RoomStatus.AVAILABLE,
        RoomStatus.MAINTENANCE,
        {
          roomNumber: roomId,
          currentStatus: RoomStatus.AVAILABLE,
          newStatus: RoomStatus.MAINTENANCE,
          reason: StatusTransitionReason.MAINTENANCE_REQUIRED,
          userId,
          timestamp: new Date(),
          businessHoursCheck: true,
          maintenanceSchedule: {
            startTime: scheduledDate,
            endTime: new Date(scheduledDate.getTime() + 24 * 60 * 60 * 1000),
            type: 'REGULAR'
          }
        }
      );

      if (!roomStatus) {
        throw new HttpException(
          'Invalid room status transition',
          ErrorCode.INVALID_OPERATION
        );
      }

      // Create maintenance request with audit trail
      const maintenanceRequest: MaintenanceModel = {
        roomId,
        description,
        status: MaintenanceStatus.PENDING,
        priority: priority || MaintenancePriority.MEDIUM,
        scheduledDate,
        estimatedCost,
        assignedTo: null,
        notes: null,
        actualCost: null,
        isRecurring: false,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        completedDate: null
      };

      // Update room status
      await this.roomStatusService.updateStatus({
        roomNumber: roomId,
        currentStatus: RoomStatus.AVAILABLE,
        newStatus: RoomStatus.MAINTENANCE,
        reason: StatusTransitionReason.MAINTENANCE_REQUIRED,
        userId,
        timestamp: new Date(),
        businessHoursCheck: true
      });

      // Clear related caches
      await this.cacheManager.del(`room:${roomId}`);
      await this.cacheManager.del('maintenance:active');

      this.logger.log(
        `Created maintenance request for room ${roomId}`,
        { userId, maintenanceRequest }
      );

      return maintenanceRequest;
    } catch (error) {
      this.logger.error(
        'Failed to create maintenance request',
        { error, body: req.body }
      );
      throw error;
    }
  }

  /**
   * Retrieves all maintenance requests with filtering and pagination
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Promise<MaintenanceModel[]>} List of maintenance requests
   */
  @Get()
  @Roles('maintenance_admin', 'facility_manager', 'maintenance_staff')
  @UseCache('maintenance:all', 300)
  async findAll(req: Request, res: Response): Promise<MaintenanceModel[]> {
    try {
      const { status, priority, roomId, dateRange } = req.query;
      
      // Apply filters
      const filters = {
        status: status ? status.split(',') : undefined,
        priority: priority ? priority.split(',') : undefined,
        roomId,
        dateRange: dateRange ? JSON.parse(dateRange as string) : undefined
      };

      const maintenanceRequests = await this.service.findAll(filters);

      this.logger.debug(
        'Retrieved maintenance requests',
        { filters, count: maintenanceRequests.length }
      );

      return maintenanceRequests;
    } catch (error) {
      this.logger.error(
        'Failed to retrieve maintenance requests',
        { error, query: req.query }
      );
      throw error;
    }
  }

  /**
   * Retrieves a specific maintenance request by ID
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Promise<MaintenanceModel>} Maintenance request details
   * @throws {HttpException} If request not found
   */
  @Get(':id')
  @Roles('maintenance_admin', 'facility_manager', 'maintenance_staff')
  @UseCache('maintenance:id', 300)
  async findById(req: Request, res: Response): Promise<MaintenanceModel> {
    try {
      const { id } = req.params;
      const maintenanceRequest = await this.service.findById(id);

      if (!maintenanceRequest) {
        throw new HttpException(
          'Maintenance request not found',
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }

      return maintenanceRequest;
    } catch (error) {
      this.logger.error(
        'Failed to retrieve maintenance request',
        { error, id: req.params.id }
      );
      throw error;
    }
  }

  /**
   * Updates an existing maintenance request
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Promise<MaintenanceModel>} Updated maintenance request
   * @throws {HttpException} If request not found or validation fails
   */
  @Put(':id')
  @UseValidation(UpdateMaintenanceDto)
  @Roles('maintenance_admin', 'facility_manager')
  @UseTransaction()
  async update(req: Request, res: Response): Promise<MaintenanceModel> {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.id;

      const existingRequest = await this.service.findById(id);
      if (!existingRequest) {
        throw new HttpException(
          'Maintenance request not found',
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }

      // Handle status transitions
      if (updates.status && updates.status !== existingRequest.status) {
        await this.handleStatusTransition(
          existingRequest,
          updates.status,
          userId
        );
      }

      const updatedRequest = await this.service.update(id, {
        ...updates,
        updatedAt: new Date()
      });

      // Clear caches
      await this.cacheManager.del(`maintenance:${id}`);
      await this.cacheManager.del('maintenance:active');

      this.logger.log(
        `Updated maintenance request ${id}`,
        { userId, updates }
      );

      return updatedRequest;
    } catch (error) {
      this.logger.error(
        'Failed to update maintenance request',
        { error, id: req.params.id, updates: req.body }
      );
      throw error;
    }
  }

  /**
   * Soft deletes a maintenance request
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Promise<void>} Deletion confirmation
   * @throws {HttpException} If request not found
   */
  @Delete(':id')
  @Roles('maintenance_admin')
  @UseTransaction()
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const existingRequest = await this.service.findById(id);
      if (!existingRequest) {
        throw new HttpException(
          'Maintenance request not found',
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }

      await this.service.delete(id);

      // Clear caches
      await this.cacheManager.del(`maintenance:${id}`);
      await this.cacheManager.del('maintenance:active');

      this.logger.log(
        `Deleted maintenance request ${id}`,
        { userId }
      );

      res.status(204).send();
    } catch (error) {
      this.logger.error(
        'Failed to delete maintenance request',
        { error, id: req.params.id }
      );
      throw error;
    }
  }

  /**
   * Handles maintenance request status transitions with validation
   * 
   * @param {MaintenanceModel} request - Current maintenance request
   * @param {MaintenanceStatus} newStatus - New status
   * @param {string} userId - User making the change
   * @throws {HttpException} If transition is invalid
   */
  private async handleStatusTransition(
    request: MaintenanceModel,
    newStatus: MaintenanceStatus,
    userId: string
  ): Promise<void> {
    const validTransitions = {
      [MaintenanceStatus.PENDING]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED],
      [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.COMPLETED, MaintenanceStatus.DEFERRED],
      [MaintenanceStatus.DEFERRED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED],
      [MaintenanceStatus.COMPLETED]: [],
      [MaintenanceStatus.CANCELLED]: []
    };

    if (!validTransitions[request.status].includes(newStatus)) {
      throw new HttpException(
        'Invalid status transition',
        ErrorCode.INVALID_OPERATION
      );
    }

    // Update room status if maintenance is completed
    if (newStatus === MaintenanceStatus.COMPLETED) {
      await this.roomStatusService.updateStatus({
        roomNumber: request.roomId,
        currentStatus: RoomStatus.MAINTENANCE,
        newStatus: RoomStatus.AVAILABLE,
        reason: StatusTransitionReason.MAINTENANCE_COMPLETE,
        userId,
        timestamp: new Date(),
        businessHoursCheck: true
      });
    }
  }
}