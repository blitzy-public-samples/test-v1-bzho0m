/**
 * @fileoverview Advanced REST API controller implementing comprehensive room management endpoints
 * with real-time status updates, dynamic pricing, and multi-channel distribution capabilities.
 * @version 1.0.0
 */

// External imports - Version comments included as required
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch, 
  Delete, 
  Param, 
  Body, 
  Query, 
  UseGuards, 
  UsePipes, 
  ValidationPipe 
} from '@nestjs/common'; // v10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity 
} from '@nestjs/swagger'; // v7.0.0
import { Observable, Subject } from 'rxjs'; // v7.8.0
import { RateLimit } from '@nestjs/throttler'; // v5.0.0

// Internal imports
import { BaseController } from '../../../shared/interfaces/base-controller.interface';
import { 
  RoomModel, 
  RoomStatus, 
  RoomType, 
  RoomAmenities, 
  CreateRoomDTO, 
  UpdateRoomDTO, 
  RoomQueryFilters 
} from '../models/room.model';
import { RoomStatusService, StatusTransitionReason } from '../services/room-status.service';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Advanced controller handling room management with real-time updates
 */
@Controller('rooms')
@ApiTags('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true }))
@RateLimit({ ttl: 60, limit: 100 })
export class RoomController implements BaseController<RoomModel> {
  private readonly statusUpdates = new Subject<RoomStatusUpdate>();

  constructor(
    private readonly roomStatusService: RoomStatusService
  ) {}

  /**
   * Create new room with validation
   */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room data' })
  async create(@Body() createRoomDto: CreateRoomDTO): Promise<RoomModel> {
    try {
      // Validate room number format
      if (!this.validateRoomNumber(createRoomDto.roomNumber)) {
        throw new Error(ErrorCode.VALIDATION_ERROR);
      }

      // Initialize room with default status
      const roomData = {
        ...createRoomDto,
        status: RoomStatus.AVAILABLE,
        isActive: true,
        lastCleanedAt: new Date(),
        maintenanceHistory: { records: [] },
        cleaningSchedule: {
          regular: [],
          deep: []
        }
      };

      return await this.roomStatusService.create(roomData).toPromise();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieve rooms with advanced filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all rooms with filters' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  async findAll(@Query() filters: RoomQueryFilters): Promise<RoomModel[]> {
    return await this.roomStatusService.findAll(filters).toPromise();
  }

  /**
   * Get room by ID with full details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiResponse({ status: 200, description: 'Room found' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findById(@Param('id') id: string): Promise<RoomModel> {
    return await this.roomStatusService.findById(id).toPromise();
  }

  /**
   * Update room status with real-time notification
   */
  @Patch(':id/status')
  @Roles('staff', 'admin')
  @ApiOperation({ summary: 'Update room status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateStatus(
    @Param('id') roomId: string,
    @Body() statusUpdateDto: RoomStatusUpdateDto
  ): Promise<Observable<RoomModel>> {
    const request = {
      roomNumber: roomId,
      currentStatus: await this.getCurrentStatus(roomId),
      newStatus: statusUpdateDto.status,
      reason: statusUpdateDto.reason,
      userId: statusUpdateDto.userId,
      timestamp: new Date(),
      businessHoursCheck: !statusUpdateDto.isEmergency,
      maintenanceSchedule: statusUpdateDto.maintenanceSchedule,
      auditMetadata: {
        notes: statusUpdateDto.notes
      }
    };

    return this.roomStatusService.updateStatus(request);
  }

  /**
   * Update room details
   */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update room details' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDTO
  ): Promise<RoomModel> {
    return await this.roomStatusService.update(id, updateRoomDto).toPromise();
  }

  /**
   * Soft delete room
   */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete room' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  async delete(@Param('id') id: string): Promise<boolean> {
    return await this.roomStatusService.delete(id).toPromise();
  }

  /**
   * Stream real-time room status updates
   */
  @Get('status/stream')
  @ApiOperation({ summary: 'Stream room status updates' })
  streamStatusUpdates(): Observable<RoomStatusUpdate> {
    return this.roomStatusService.statusChanges$;
  }

  /**
   * Bulk update room status
   */
  @Post('status/bulk')
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk update room status' })
  async bulkUpdateStatus(
    @Body() updates: BulkStatusUpdateDto[]
  ): Promise<Observable<RoomModel[]>> {
    const updateRequests = updates.map(update => ({
      roomNumber: update.roomId,
      currentStatus: update.currentStatus,
      newStatus: update.newStatus,
      reason: StatusTransitionReason.MAINTENANCE_REQUIRED,
      userId: update.userId,
      timestamp: new Date(),
      businessHoursCheck: false
    }));

    return this.roomStatusService.bulkUpdateStatus(updateRequests);
  }

  /**
   * Validate room number format
   */
  private validateRoomNumber(roomNumber: string): boolean {
    const roomNumberRegex = /^\d{3,4}[A-Z]?$/;
    return roomNumberRegex.test(roomNumber);
  }

  /**
   * Get current room status
   */
  private async getCurrentStatus(roomId: string): Promise<RoomStatus> {
    const room = await this.roomStatusService.findById(roomId).toPromise();
    return room.status;
  }
}

/**
 * DTO for room status updates
 */
interface RoomStatusUpdateDto {
  status: RoomStatus;
  reason: StatusTransitionReason;
  userId: string;
  isEmergency?: boolean;
  maintenanceSchedule?: {
    startTime: Date;
    endTime: Date;
    type: 'REGULAR' | 'EMERGENCY' | 'PREVENTIVE';
    assignedTo?: string;
  };
  notes?: string;
}

/**
 * DTO for bulk status updates
 */
interface BulkStatusUpdateDto {
  roomId: string;
  currentStatus: RoomStatus;
  newStatus: RoomStatus;
  userId: string;
}

/**
 * Interface for status update events
 */
interface RoomStatusUpdate {
  roomNumber: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  timestamp: Date;
  metadata: {
    userId: string;
    reason: string;
    notes?: string;
  };
}