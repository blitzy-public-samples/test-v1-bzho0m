/**
 * @fileoverview Defines the base controller interface that all microservice REST API controllers must implement.
 * Provides standardized HTTP endpoint handlers, error handling, validation, and response patterns.
 * @version 1.0.0
 */

// External imports - v4.18.0
import { Request, Response, NextFunction } from 'express';

// Internal imports
import { BaseService } from './base-service.interface';
import { BaseModel } from './base-model.interface';
import { ErrorCode } from '../constants/error-codes';

/**
 * Extended Express Request type that includes authenticated user data
 */
export interface RequestWithUser extends Request {
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
}

/**
 * Generic API response format with error handling
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Paginated response format for list endpoints
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Base controller interface that defines standard REST API endpoints all controllers must implement.
 * Provides consistent error handling, validation, and response patterns across the application.
 * 
 * @interface BaseController
 * @template T - Entity type that extends BaseModel
 * 
 * @example
 * class RoomController implements BaseController<Room> {
 *   constructor(private roomService: BaseService<Room>) {}
 *   // Implementation of CRUD endpoints for Room entity
 * }
 */
export interface BaseController<T extends BaseModel> {
  /**
   * Reference to the service layer handling business logic
   */
  service: BaseService<T>;

  /**
   * Creates a new resource via POST request
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with created resource or error
   * 
   * @throws {ErrorCode.VALIDATION_ERROR} If request body fails validation
   * @throws {ErrorCode.AUTHORIZATION_ERROR} If user lacks create permission
   * @throws {ErrorCode.DATABASE_ERROR} If creation fails
   */
  create(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;

  /**
   * Retrieves all resources with pagination via GET request
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with paginated resources or error
   * 
   * @throws {ErrorCode.AUTHORIZATION_ERROR} If user lacks read permission
   * @throws {ErrorCode.DATABASE_ERROR} If retrieval fails
   */
  findAll(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;

  /**
   * Retrieves a single resource by ID via GET request
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with resource or error
   * 
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If resource doesn't exist
   * @throws {ErrorCode.AUTHORIZATION_ERROR} If user lacks read permission
   * @throws {ErrorCode.DATABASE_ERROR} If retrieval fails
   */
  findById(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;

  /**
   * Updates an existing resource via PUT request
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with updated resource or error
   * 
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If resource doesn't exist
   * @throws {ErrorCode.VALIDATION_ERROR} If request body fails validation
   * @throws {ErrorCode.AUTHORIZATION_ERROR} If user lacks update permission
   * @throws {ErrorCode.DATABASE_ERROR} If update fails
   */
  update(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;

  /**
   * Soft deletes an existing resource via DELETE request
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with deletion confirmation or error
   * 
   * @throws {ErrorCode.RESOURCE_NOT_FOUND} If resource doesn't exist
   * @throws {ErrorCode.AUTHORIZATION_ERROR} If user lacks delete permission
   * @throws {ErrorCode.DATABASE_ERROR} If deletion fails
   */
  delete(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;
}