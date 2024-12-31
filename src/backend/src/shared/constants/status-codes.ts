/**
 * @fileoverview Standardized HTTP status codes for the Hotel Management ERP system.
 * Provides a centralized, type-safe enumeration of status codes used across all microservices
 * to ensure consistent API responses and error handling.
 * @version 1.0.0
 */

/**
 * Enumeration of standard HTTP status codes with specific usage contexts
 * for the hotel management system's microservices architecture.
 * 
 * These status codes are used to provide consistent response status across all API endpoints
 * and standardize error handling throughout the system.
 */
export enum HttpStatusCode {
  /**
   * 200 OK
   * Standard response for successful HTTP requests.
   * Used for successful data retrieval and updates in operations like:
   * - Fetching room availability
   * - Retrieving guest information
   * - Updating booking details
   */
  OK = 200,

  /**
   * 201 Created
   * Request succeeded and new resource was created.
   * Used when successfully creating new resources like:
   * - New room bookings
   * - Guest profiles
   * - Service requests
   */
  CREATED = 201,

  /**
   * 202 Accepted
   * Request accepted for processing but not yet completed.
   * Used for asynchronous operations such as:
   * - Room service requests
   * - Housekeeping tasks
   * - Payment processing
   */
  ACCEPTED = 202,

  /**
   * 204 No Content
   * Server successfully processed the request but returns no content.
   * Used for operations like:
   * - Successful deletions
   * - Status updates
   * - Logout operations
   */
  NO_CONTENT = 204,

  /**
   * 400 Bad Request
   * Server cannot process the request due to client error.
   * Used for validation failures such as:
   * - Invalid booking dates
   * - Missing required guest information
   * - Incorrect payment details
   */
  BAD_REQUEST = 400,

  /**
   * 401 Unauthorized
   * Authentication is required or has failed.
   * Used when:
   * - Missing authentication token
   * - Invalid credentials
   * - Expired session
   */
  UNAUTHORIZED = 401,

  /**
   * 403 Forbidden
   * Client lacks necessary permissions.
   * Used for authorization failures like:
   * - Staff accessing admin-only functions
   * - Attempting operations outside assigned role
   * - Accessing restricted room information
   */
  FORBIDDEN = 403,

  /**
   * 404 Not Found
   * Requested resource could not be found.
   * Used when attempting to access:
   * - Non-existent room numbers
   * - Invalid booking references
   * - Deleted guest profiles
   */
  NOT_FOUND = 404,

  /**
   * 409 Conflict
   * Request conflicts with current state of the server.
   * Used for concurrent operation conflicts like:
   * - Double booking attempts
   * - Concurrent room status updates
   * - Conflicting guest profile modifications
   */
  CONFLICT = 409,

  /**
   * 429 Too Many Requests
   * User has sent too many requests in a given time period.
   * Used for rate limiting:
   * - API request throttling
   * - Booking attempt limits
   * - Search query restrictions
   */
  TOO_MANY_REQUESTS = 429,

  /**
   * 500 Internal Server Error
   * Unexpected condition encountered on server.
   * Used for unhandled exceptions and system errors:
   * - Database connection failures
   * - Integration service errors
   * - Unhandled runtime exceptions
   */
  INTERNAL_SERVER_ERROR = 500,

  /**
   * 503 Service Unavailable
   * Server temporarily unable to handle request.
   * Used during:
   * - Scheduled maintenance
   * - System overload
   * - Circuit breaker activation
   */
  SERVICE_UNAVAILABLE = 503
}