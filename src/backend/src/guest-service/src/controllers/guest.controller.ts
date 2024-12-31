/**
 * @fileoverview Guest controller implementing secure REST API endpoints for guest management
 * with GDPR compliance, data protection, and comprehensive error handling.
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
  UseGuards,
  UseInterceptors,
  Logger,
  HttpStatus
} from '@nestjs/common'; // v10.0.0
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody
} from '@nestjs/swagger'; // v7.0.0
import { Observable, throwError } from 'rxjs'; // v7.8.0
import { catchError, map } from 'rxjs/operators'; // v7.8.0

// Internal imports
import { BaseController } from '../../../shared/interfaces/base-controller.interface';
import { GuestService } from '../services/guest.service';
import { validateRequest } from '../../../shared/utils/validation.util';
import { Guest } from '../models/guest.model';
import { CreateGuestDto, UpdateGuestDto, GuestFilterDto } from '../dto';
import { AuthGuard, RoleGuard } from '../../../shared/guards';
import { LoggingInterceptor, DataMaskingInterceptor } from '../../../shared/interceptors';
import { ErrorCode, createErrorDetails } from '../../../shared/constants/error-codes';
import { UUID } from '../../../shared/interfaces/base-model.interface';

/**
 * Controller handling HTTP requests for guest management with enhanced security,
 * GDPR compliance, and comprehensive error handling.
 * 
 * @implements {BaseController<Guest>}
 */
@Controller('guests')
@ApiTags('Guests')
@ApiSecurity('bearer')
@UseGuards(AuthGuard, RoleGuard)
@UseInterceptors(LoggingInterceptor, DataMaskingInterceptor)
export class GuestController implements BaseController<Guest> {
  private readonly logger = new Logger(GuestController.name);

  constructor(private readonly guestService: GuestService) {}

  /**
   * Creates a new guest profile with GDPR consent validation.
   * 
   * @param {CreateGuestDto} guestData - Guest profile data
   * @returns {Observable<Guest>} Created guest profile with masked PII
   */
  @Post()
  @ApiOperation({ summary: 'Create new guest profile' })
  @ApiBody({ type: CreateGuestDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Guest created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'GDPR consent required' })
  create(@Body() guestData: CreateGuestDto): Observable<Guest> {
    this.logger.debug(`Creating guest profile: ${guestData.email}`);

    return new Observable(subscriber => {
      validateRequest(guestData, CreateGuestDto.schema, '/guests', 'create-guest')
        .then(validation => {
          if (!validation.isValid) {
            throw createErrorDetails(
              ErrorCode.VALIDATION_ERROR,
              { errors: validation.errors }
            );
          }

          return this.guestService.validateGDPRConsent(guestData.gdprConsent);
        })
        .then(() => {
          return this.guestService.create(guestData);
        })
        .then(guest => {
          subscriber.next(guest);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Retrieves all guests with filtering and PII protection.
   * 
   * @param {GuestFilterDto} filters - Query filters
   * @returns {Observable<Guest[]>} List of guest profiles with masked PII
   */
  @Get()
  @ApiOperation({ summary: 'Get all guests with filtering' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of guests' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  findAll(@Query() filters: GuestFilterDto): Observable<Guest[]> {
    this.logger.debug('Retrieving guest list with filters');

    return new Observable(subscriber => {
      validateRequest(filters, GuestFilterDto.schema, '/guests', 'filter-guests')
        .then(validation => {
          if (!validation.isValid) {
            throw createErrorDetails(
              ErrorCode.VALIDATION_ERROR,
              { errors: validation.errors }
            );
          }

          return this.guestService.findAll(filters);
        })
        .then(guests => {
          subscriber.next(guests);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Retrieves a guest by ID with security checks.
   * 
   * @param {UUID} id - Guest ID
   * @returns {Observable<Guest>} Guest profile with masked PII
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get guest by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Guest profile' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Guest not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  findById(@Param('id') id: UUID): Observable<Guest> {
    this.logger.debug(`Retrieving guest profile: ${id}`);

    return this.guestService.findById(id).pipe(
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Updates a guest profile with GDPR compliance.
   * 
   * @param {UUID} id - Guest ID
   * @param {UpdateGuestDto} updateData - Updated guest data
   * @returns {Observable<Guest>} Updated guest profile with masked PII
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update guest profile' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateGuestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Guest updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  update(
    @Param('id') id: UUID,
    @Body() updateData: UpdateGuestDto
  ): Observable<Guest> {
    this.logger.debug(`Updating guest profile: ${id}`);

    return new Observable(subscriber => {
      validateRequest(updateData, UpdateGuestDto.schema, `/guests/${id}`, 'update-guest')
        .then(validation => {
          if (!validation.isValid) {
            throw createErrorDetails(
              ErrorCode.VALIDATION_ERROR,
              { errors: validation.errors }
            );
          }

          return this.guestService.update(id, updateData);
        })
        .then(guest => {
          subscriber.next(guest);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Soft deletes a guest profile with GDPR compliance.
   * 
   * @param {UUID} id - Guest ID
   * @returns {Observable<boolean>} Deletion success status
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete guest profile' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Guest deleted successfully' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  delete(@Param('id') id: UUID): Observable<boolean> {
    this.logger.debug(`Deleting guest profile: ${id}`);

    return this.guestService.delete(id).pipe(
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Updates guest preferences with consent validation.
   * 
   * @param {UUID} id - Guest ID
   * @param {UpdatePreferenceDto} preferences - Updated preferences
   * @returns {Observable<Preference>} Updated preferences
   */
  @Put(':id/preferences')
  @ApiOperation({ summary: 'Update guest preferences' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: 'UpdatePreferenceDto' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid preferences data' })
  updatePreferences(
    @Param('id') id: UUID,
    @Body() preferences: UpdatePreferenceDto
  ): Observable<Preference> {
    this.logger.debug(`Updating preferences for guest: ${id}`);

    return new Observable(subscriber => {
      validateRequest(preferences, UpdatePreferenceDto.schema, `/guests/${id}/preferences`, 'update-preferences')
        .then(validation => {
          if (!validation.isValid) {
            throw createErrorDetails(
              ErrorCode.VALIDATION_ERROR,
              { errors: validation.errors }
            );
          }

          return this.guestService.updatePreferences(id, preferences);
        })
        .then(updatedPreferences => {
          subscriber.next(updatedPreferences);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      catchError(error => throwError(() => error))
    );
  }
}