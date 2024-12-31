/**
 * @fileoverview Defines the base service interface that all microservice business logic services must implement.
 * Provides standardized CRUD operations with reactive programming support through RxJS Observables.
 * @version 1.0.0
 */

// External imports
import { Observable } from 'rxjs'; // v7.8.0

// Internal imports
import { BaseModel, UUID } from './base-model.interface';
import { ErrorCode } from '../constants/error-codes';

/**
 * Generic base service interface that defines standard CRUD operations with reactive programming support.
 * Must be implemented by all service classes to ensure consistent business logic implementation.
 * 
 * @interface BaseService
 * @template T - Entity type that extends BaseModel to ensure presence of standard fields
 * 
 * @example
 * class RoomService implements BaseService<Room> {
 *   // Implementation of CRUD methods for Room entity
 * }
 * 
 * @example
 * class GuestService implements BaseService<Guest> {
 *   // Implementation of CRUD methods for Guest entity
 * }
 */
export interface BaseService<T extends BaseModel> {
  /**
   * Creates a new entity with error handling for validation and database errors.
   * 
   * @param {Partial<T>} data - Entity data to create, allowing partial fields for flexibility
   * @returns {Observable<T>} Observable that emits the created entity or error
   * @throws {ErrorCode.VALIDATION_ERROR} If provided data is invalid
   * @throws {ErrorCode.DATABASE_ERROR} If database operation fails
   * 
   * @example
   * service.create({ name: 'John Doe', email: 'john@example.com' })
   *   .subscribe(
   *     created => console.log('Created:', created),
   *     error => console.error('Error:', error)
   *   );
   */
  create(data: Partial<T>): Observable<T>;

  /**
   * Retrieves an entity by ID with error handling for not found cases.
   * 
   * @param {UUID} id - Entity ID to find
   * @returns {Observable<T>} Observable that emits the found entity or error
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If entity with given ID doesn't exist
   * @throws {ErrorCode.DATABASE_ERROR} If database operation fails
   * 
   * @example
   * service.findById('123e4567-e89b-12d3-a456-426614174000')
   *   .subscribe(
   *     entity => console.log('Found:', entity),
   *     error => console.error('Error:', error)
   *   );
   */
  findById(id: UUID): Observable<T>;

  /**
   * Retrieves all entities with optional filtering and error handling.
   * 
   * @param {Partial<T>} [filter] - Optional filter criteria for querying entities
   * @returns {Observable<T[]>} Observable that emits array of matching entities or error
   * @throws {ErrorCode.DATABASE_ERROR} If database operation fails
   * 
   * @example
   * service.findAll({ status: 'active' })
   *   .subscribe(
   *     entities => console.log('Found:', entities),
   *     error => console.error('Error:', error)
   *   );
   */
  findAll(filter?: Partial<T>): Observable<T[]>;

  /**
   * Updates an existing entity with validation and error handling.
   * 
   * @param {UUID} id - Entity ID to update
   * @param {Partial<T>} data - Updated entity data, allowing partial updates
   * @returns {Observable<T>} Observable that emits the updated entity or error
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If entity with given ID doesn't exist
   * @throws {ErrorCode.VALIDATION_ERROR} If provided data is invalid
   * @throws {ErrorCode.DATABASE_ERROR} If database operation fails
   * 
   * @example
   * service.update('123e4567-e89b-12d3-a456-426614174000', { status: 'inactive' })
   *   .subscribe(
   *     updated => console.log('Updated:', updated),
   *     error => console.error('Error:', error)
   *   );
   */
  update(id: UUID, data: Partial<T>): Observable<T>;

  /**
   * Soft deletes an entity by setting deletedAt timestamp.
   * 
   * @param {UUID} id - Entity ID to soft delete
   * @returns {Observable<boolean>} Observable that emits true if delete successful, false otherwise
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If entity with given ID doesn't exist
   * @throws {ErrorCode.DATABASE_ERROR} If database operation fails
   * 
   * @example
   * service.delete('123e4567-e89b-12d3-a456-426614174000')
   *   .subscribe(
   *     success => console.log('Deleted:', success),
   *     error => console.error('Error:', error)
   *   );
   */
  delete(id: UUID): Observable<boolean>;
}