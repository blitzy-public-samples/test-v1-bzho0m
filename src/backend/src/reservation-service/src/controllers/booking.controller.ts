/**
 * @fileoverview Implements comprehensive booking controller with enhanced validation,
 * real-time availability checking, dynamic pricing, and audit logging capabilities.
 * @version 1.0.0
 */

// External imports
import { 
  Controller, Post, Get, Put, Delete, Body, Param, Query, 
  UseGuards, UseInterceptors, UsePipes, HttpStatus
} from '@nestjs/common'; // v10.0.0
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBody, 
  ApiQuery, ApiParam 
} from '@nestjs/swagger'; // v7.0.0
import { Observable, from, mergeMap, catchError, timeout } from 'rxjs'; // v7.8.0

// Internal imports
import { BaseController } from '../../../shared/interfaces/base-controller.interface';
import { 
  Booking, BookingModel, BookingStatus, 
  CreateBookingDto, BookingFilterDto, BatchBookingDto 
} from '../models/booking.model';
import { AvailabilityService } from '../services/availability.service';
import { ErrorCode } from '../../../shared/constants/error-codes';

@Controller('bookings')
@ApiTags('Bookings')
@UseGuards(AuthGuard)
@UseInterceptors(CacheInterceptor, LoggingInterceptor)
@UsePipes(ValidationPipe)
export class BookingController implements BaseController<Booking> {
  constructor(
    private readonly bookingModel: BookingModel,
    private readonly availabilityService: AvailabilityService,
    private readonly pricingService: PricingService,
    private readonly cacheManager: CacheManager,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Creates a new booking with comprehensive validation and availability checking
   */
  @Post()
  @ApiOperation({ summary: 'Create new booking' })
  @UseGuards(ThrottleGuard)
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Booking created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid booking data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Room not available' })
  async create(@Body() bookingData: CreateBookingDto): Promise<Booking> {
    try {
      // Check room availability
      const isAvailable = await this.availabilityService.validateAvailability(
        [bookingData.roomId],
        bookingData.checkInDate,
        bookingData.checkOutDate
      ).toPromise();

      if (!isAvailable) {
        throw new Error(ErrorCode.RESOURCE_CONFLICT);
      }

      // Calculate dynamic rate
      const rate = await this.pricingService.calculateRate(
        bookingData.rateId,
        bookingData.checkInDate,
        bookingData.checkOutDate,
        await this.availabilityService.getCurrentOccupancy(),
        bookingData.bookingSource
      );

      // Create booking with audit trail
      const booking = await this.bookingModel.create({
        ...bookingData,
        status: BookingStatus.PENDING,
        totalAmount: rate,
        auditTrail: [{
          timestamp: new Date(),
          action: 'BOOKING_CREATED',
          userId: bookingData.lastModifiedBy,
          changes: { status: 'PENDING' }
        }]
      });

      // Invalidate availability cache
      await this.cacheManager.del(`availability:${bookingData.roomId}`);

      // Log audit trail
      await this.auditLogger.log({
        action: 'CREATE_BOOKING',
        resourceId: booking.id,
        userId: bookingData.lastModifiedBy,
        details: booking
      });

      return booking;
    } catch (error) {
      this.auditLogger.error('Booking creation failed', {
        error,
        bookingData
      });
      throw error;
    }
  }

  /**
   * Creates multiple bookings in a batch operation
   */
  @Post('batch')
  @ApiOperation({ summary: 'Create multiple bookings' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Bookings created successfully' })
  async createBatch(@Body() batchData: BatchBookingDto): Promise<Booking[]> {
    try {
      // Validate all rooms availability
      const roomIds = batchData.bookings.map(booking => booking.roomId);
      const isAvailable = await this.availabilityService.checkBatchAvailability(
        roomIds,
        batchData.checkInDate,
        batchData.checkOutDate
      ).toPromise();

      if (!isAvailable) {
        throw new Error(ErrorCode.RESOURCE_CONFLICT);
      }

      // Create bookings in transaction
      const bookings = await this.bookingModel.createBatch(batchData.bookings);

      // Invalidate cache for all affected rooms
      await Promise.all(
        roomIds.map(roomId => this.cacheManager.del(`availability:${roomId}`))
      );

      return bookings;
    } catch (error) {
      this.auditLogger.error('Batch booking creation failed', {
        error,
        batchData
      });
      throw error;
    }
  }

  /**
   * Retrieves all bookings with filtering and pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get all bookings' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query() filter: BookingFilterDto): Promise<Booking[]> {
    return this.bookingModel.findAll(filter);
  }

  /**
   * Retrieves a specific booking by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', required: true })
  async findById(@Param('id') id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id);
    if (!booking) {
      throw new Error(ErrorCode.RESOURCE_NOT_FOUND);
    }
    return booking;
  }

  /**
   * Updates an existing booking with validation
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update booking' })
  @ApiParam({ name: 'id', required: true })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<Booking>
  ): Promise<Booking> {
    try {
      const booking = await this.bookingModel.update(id, updateData);
      
      // Invalidate cache if dates changed
      if (updateData.checkInDate || updateData.checkOutDate) {
        await this.cacheManager.del(`availability:${booking.roomId}`);
      }

      await this.auditLogger.log({
        action: 'UPDATE_BOOKING',
        resourceId: id,
        userId: updateData.lastModifiedBy,
        details: updateData
      });

      return booking;
    } catch (error) {
      this.auditLogger.error('Booking update failed', {
        error,
        bookingId: id,
        updateData
      });
      throw error;
    }
  }

  /**
   * Processes booking cancellation
   */
  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiParam({ name: 'id', required: true })
  async cancel(
    @Param('id') id: string,
    @Body() cancellationData: { reason: string; userId: string }
  ): Promise<Booking> {
    try {
      const booking = await this.bookingModel.update(id, {
        status: BookingStatus.CANCELLED,
        cancellationReason: cancellationData.reason,
        cancellationDate: new Date(),
        lastModifiedBy: cancellationData.userId
      });

      await this.cacheManager.del(`availability:${booking.roomId}`);

      await this.auditLogger.log({
        action: 'CANCEL_BOOKING',
        resourceId: id,
        userId: cancellationData.userId,
        details: { reason: cancellationData.reason }
      });

      return booking;
    } catch (error) {
      this.auditLogger.error('Booking cancellation failed', {
        error,
        bookingId: id
      });
      throw error;
    }
  }

  /**
   * Processes guest check-in
   */
  @Put(':id/check-in')
  @ApiOperation({ summary: 'Process check-in' })
  @ApiParam({ name: 'id', required: true })
  async checkIn(
    @Param('id') id: string,
    @Body() checkInData: { userId: string }
  ): Promise<Booking> {
    try {
      const booking = await this.bookingModel.update(id, {
        status: BookingStatus.CHECKED_IN,
        lastModifiedBy: checkInData.userId
      });

      await this.auditLogger.log({
        action: 'CHECK_IN',
        resourceId: id,
        userId: checkInData.userId,
        details: booking
      });

      return booking;
    } catch (error) {
      this.auditLogger.error('Check-in failed', {
        error,
        bookingId: id
      });
      throw error;
    }
  }

  /**
   * Processes guest check-out
   */
  @Put(':id/check-out')
  @ApiOperation({ summary: 'Process check-out' })
  @ApiParam({ name: 'id', required: true })
  async checkOut(
    @Param('id') id: string,
    @Body() checkOutData: { userId: string }
  ): Promise<Booking> {
    try {
      const booking = await this.bookingModel.update(id, {
        status: BookingStatus.CHECKED_OUT,
        lastModifiedBy: checkOutData.userId
      });

      await this.cacheManager.del(`availability:${booking.roomId}`);

      await this.auditLogger.log({
        action: 'CHECK_OUT',
        resourceId: id,
        userId: checkOutData.userId,
        details: booking
      });

      return booking;
    } catch (error) {
      this.auditLogger.error('Check-out failed', {
        error,
        bookingId: id
      });
      throw error;
    }
  }
}