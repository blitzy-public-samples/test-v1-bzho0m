/**
 * @fileoverview Controller handling comprehensive room rate management including dynamic pricing,
 * rate parity, yield management, and channel-specific rate handling.
 * @version 1.0.0
 */

// External imports
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  CacheTTL,
  UseInterceptors,
  CacheInterceptor,
  Logger,
  BadRequestException
} from '@nestjs/common'; // v10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBody 
} from '@nestjs/swagger'; // v7.0.0
import { Observable, from, throwError } from 'rxjs'; // v7.8.0
import { map, catchError } from 'rxjs/operators';

// Internal imports
import { BaseController } from '../../../shared/interfaces/base-controller.interface';
import { Rate, RateType, RateStatus } from '../models/rate.model';
import { PricingService } from '../services/pricing.service';
import { parseDate, isValidBookingRange } from '../../../shared/utils/date.util';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Interface for rate calculation request
 */
interface RateCalculationRequest {
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  channelId: string;
  occupancyData?: {
    currentOccupancy: number;
    forecastedOccupancy: number;
  };
}

/**
 * Interface for rate calculation response
 */
interface RateCalculationResponse {
  baseRate: number;
  finalRate: number;
  breakdown: {
    seasonalAdjustment: number;
    occupancyAdjustment: number;
    losAdjustment: number;
    channelMarkup: number;
    taxes: number;
  };
  appliedRules: string[];
  validUntil: Date;
}

/**
 * Controller handling dynamic room rate management and calculations
 */
@Controller('rates')
@ApiTags('rates')
@UseInterceptors(CacheInterceptor)
export class RateController implements BaseController<Rate> {
  private readonly logger = new Logger(RateController.name);

  constructor(
    private readonly pricingService: PricingService
  ) {}

  /**
   * Calculates dynamic room rate based on multiple factors
   */
  @Get('calculate')
  @CacheTTL(300) // 5 minute cache
  @ApiOperation({ summary: 'Calculate dynamic room rate' })
  @ApiResponse({ status: 200, description: 'Rate calculated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  calculateDynamicRate(
    @Query() request: RateCalculationRequest
  ): Observable<RateCalculationResponse> {
    try {
      // Parse and validate dates
      const checkIn = parseDate(request.checkInDate);
      const checkOut = parseDate(request.checkOutDate);

      if (!isValidBookingRange(checkIn, checkOut)) {
        return throwError(() => new BadRequestException(
          'Invalid booking date range'
        ));
      }

      // Get current occupancy or use provided data
      const occupancyPercentage = request.occupancyData?.currentOccupancy || 70;

      return this.pricingService.calculateRoomRate(
        request.roomTypeId,
        checkIn,
        checkOut,
        occupancyPercentage,
        request.channelId
      ).pipe(
        map(result => ({
          baseRate: result.baseRate,
          finalRate: result.finalRate,
          breakdown: result.breakdown,
          appliedRules: result.appliedRules,
          validUntil: result.validUntil
        })),
        catchError(error => {
          this.logger.error(
            `Rate calculation failed: ${error.message}`,
            error.stack
          );
          return throwError(() => new BadRequestException(
            error.message || 'Rate calculation failed'
          ));
        })
      );
    } catch (error) {
      return throwError(() => new BadRequestException(
        error.message || 'Invalid request parameters'
      ));
    }
  }

  /**
   * Validates rate parity across channels
   */
  @Get('validate-parity/:rateId')
  @ApiOperation({ summary: 'Validate rate parity across channels' })
  @ApiParam({ name: 'rateId', description: 'Rate ID to validate' })
  validateRateParity(
    @Param('rateId') rateId: string
  ): Observable<{ isValid: boolean; violations: any[] }> {
    return from(this.pricingService.validateRateParity(rateId)).pipe(
      map(result => ({
        isValid: result.isValid,
        violations: result.violations
      })),
      catchError(error => {
        this.logger.error(
          `Rate parity validation failed: ${error.message}`,
          error.stack
        );
        return throwError(() => new BadRequestException(
          error.message || 'Rate parity validation failed'
        ));
      })
    );
  }

  /**
   * Synchronizes rates across all channels
   */
  @Post('sync-channels')
  @ApiOperation({ summary: 'Synchronize rates across channels' })
  syncChannelRates(
    @Body() syncRequest: { rateIds: string[] }
  ): Observable<{ success: boolean; syncedChannels: string[] }> {
    return from(this.pricingService.syncChannelRates(syncRequest.rateIds)).pipe(
      map(result => ({
        success: true,
        syncedChannels: result.channels
      })),
      catchError(error => {
        this.logger.error(
          `Channel rate sync failed: ${error.message}`,
          error.stack
        );
        return throwError(() => new BadRequestException(
          error.message || 'Channel rate sync failed'
        ));
      })
    );
  }

  /**
   * Updates yield management rules
   */
  @Put('yield-rules')
  @ApiOperation({ summary: 'Update yield management rules' })
  updateYieldRules(
    @Body() rules: any
  ): Observable<{ success: boolean }> {
    return from(this.pricingService.updateYieldRules(rules)).pipe(
      map(() => ({ success: true })),
      catchError(error => {
        this.logger.error(
          `Yield rules update failed: ${error.message}`,
          error.stack
        );
        return throwError(() => new BadRequestException(
          error.message || 'Yield rules update failed'
        ));
      })
    );
  }

  // Implementing required BaseController methods

  @Post()
  create(@Body() rate: Partial<Rate>): Observable<Rate> {
    return from(this.pricingService.create(rate)).pipe(
      catchError(error => throwError(() => new BadRequestException(error.message)))
    );
  }

  @Get()
  findAll(): Observable<Rate[]> {
    return from(this.pricingService.findAll()).pipe(
      catchError(error => throwError(() => new BadRequestException(error.message)))
    );
  }

  @Get(':id')
  findById(@Param('id') id: string): Observable<Rate> {
    return from(this.pricingService.findById(id)).pipe(
      catchError(error => throwError(() => new BadRequestException(error.message)))
    );
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() rate: Partial<Rate>): Observable<Rate> {
    return from(this.pricingService.update(id, rate)).pipe(
      catchError(error => throwError(() => new BadRequestException(error.message)))
    );
  }

  @Delete(':id')
  delete(@Param('id') id: string): Observable<boolean> {
    return from(this.pricingService.delete(id)).pipe(
      catchError(error => throwError(() => new BadRequestException(error.message)))
    );
  }
}