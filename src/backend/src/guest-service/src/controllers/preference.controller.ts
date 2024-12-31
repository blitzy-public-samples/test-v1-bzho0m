/**
 * @fileoverview Controller handling HTTP endpoints for guest preference management
 * with enhanced security, validation, and documentation features.
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
  UseGuards, 
  UsePipes,
  ValidationPipe,
  Logger,
  HttpStatus,
  Request
} from '@nestjs/common'; // v10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity,
  ApiBearerAuth
} from '@nestjs/swagger'; // v7.0.0
import { Observable, throwError } from 'rxjs'; // v7.8.0
import { catchError, map } from 'rxjs/operators'; // v7.8.0
import { RateLimit } from '@nestjs/throttler'; // v5.0.0

// Internal imports
import { BaseController } from '../../../shared/interfaces/base-controller.interface';
import { Preference } from '../models/preference.model';
import { GuestService } from '../services/guest.service';
import { AuthGuard } from '../../../shared/guards/auth.guard';
import { ErrorCode, createErrorDetails } from '../../../shared/constants/error-codes';
import { RequestWithUser } from '../../../shared/interfaces/base-controller.interface';

/**
 * Controller implementing secure REST endpoints for guest preference management
 * with comprehensive validation and monitoring.
 */
@Controller('preferences')
@ApiTags('Guest Preferences')
@ApiBearerAuth()
@ApiSecurity('bearer')
@UseGuards(AuthGuard)
@RateLimit({ limit: 100, ttl: 60 })
export class PreferenceController implements BaseController<Preference> {
  private readonly logger = new Logger(PreferenceController.name);

  constructor(private readonly guestService: GuestService) {}

  /**
   * Creates new guest preferences with validation and security checks
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {CreatePreferenceDto} preferenceData - Guest preference data
   * @returns {Observable<Preference>} Created preference record
   */
  @Post()
  @ApiOperation({ summary: 'Create guest preferences' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Preferences created successfully',
    type: Preference
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Unauthorized' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  create(
    @Request() req: RequestWithUser,
    @Body() preferenceData: CreatePreferenceDto
  ): Observable<Preference> {
    this.logger.debug(`Creating preferences for guest: ${preferenceData.guestId}`);

    return this.guestService.updatePreferences(preferenceData).pipe(
      map(preference => {
        this.logger.debug(`Preferences created for guest: ${preference.guestId}`);
        return preference;
      }),
      catchError(error => {
        this.logger.error(`Failed to create preferences: ${error.message}`);
        return throwError(() => createErrorDetails(
          ErrorCode.DATABASE_ERROR,
          { message: 'Failed to create preferences' }
        ));
      })
    );
  }

  /**
   * Retrieves guest preferences by guest ID
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {string} guestId - Guest ID
   * @returns {Observable<Preference>} Guest preferences
   */
  @Get(':guestId')
  @ApiOperation({ summary: 'Get guest preferences' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Preferences retrieved successfully',
    type: Preference
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Preferences not found' 
  })
  findByGuestId(
    @Request() req: RequestWithUser,
    @Param('guestId') guestId: string
  ): Observable<Preference> {
    this.logger.debug(`Retrieving preferences for guest: ${guestId}`);

    return this.guestService.findPreferencesByGuestId(guestId).pipe(
      map(preference => {
        if (!preference) {
          throw createErrorDetails(
            ErrorCode.RESOURCE_NOT_FOUND,
            { message: 'Preferences not found' }
          );
        }
        return preference;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Updates existing guest preferences
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {string} guestId - Guest ID
   * @param {UpdatePreferenceDto} updateData - Updated preference data
   * @returns {Observable<Preference>} Updated preferences
   */
  @Put(':guestId')
  @ApiOperation({ summary: 'Update guest preferences' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Preferences updated successfully',
    type: Preference
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Preferences not found' 
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  update(
    @Request() req: RequestWithUser,
    @Param('guestId') guestId: string,
    @Body() updateData: UpdatePreferenceDto
  ): Observable<Preference> {
    this.logger.debug(`Updating preferences for guest: ${guestId}`);

    return this.guestService.updatePreferences(guestId, updateData).pipe(
      map(preference => {
        this.logger.debug(`Preferences updated for guest: ${guestId}`);
        return preference;
      }),
      catchError(error => {
        this.logger.error(`Failed to update preferences: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Deletes guest preferences
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {string} guestId - Guest ID
   * @returns {Observable<boolean>} Deletion status
   */
  @Delete(':guestId')
  @ApiOperation({ summary: 'Delete guest preferences' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Preferences deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Preferences not found' 
  })
  delete(
    @Request() req: RequestWithUser,
    @Param('guestId') guestId: string
  ): Observable<boolean> {
    this.logger.debug(`Deleting preferences for guest: ${guestId}`);

    return this.guestService.deletePreferences(guestId).pipe(
      map(success => {
        this.logger.debug(`Preferences deleted for guest: ${guestId}`);
        return success;
      }),
      catchError(error => {
        this.logger.error(`Failed to delete preferences: ${error.message}`);
        return throwError(() => error);
      })
    );
  }
}

/**
 * DTO for creating guest preferences
 */
export class CreatePreferenceDto implements Partial<Preference> {
  guestId: string;
  roomType: string;
  floorLevel: number;
  smokingRoom: boolean;
  bedType: string[];
  pillowType: string[];
  amenities: string[];
  dietaryRestrictions: string;
  temperature: string;
  specialRequests: any;
  accessibilityNeeds: string;
  communicationPreferences: any;
}

/**
 * DTO for updating guest preferences
 */
export class UpdatePreferenceDto implements Partial<Preference> {
  roomType?: string;
  floorLevel?: number;
  smokingRoom?: boolean;
  bedType?: string[];
  pillowType?: string[];
  amenities?: string[];
  dietaryRestrictions?: string;
  temperature?: string;
  specialRequests?: any;
  accessibilityNeeds?: string;
  communicationPreferences?: any;
}