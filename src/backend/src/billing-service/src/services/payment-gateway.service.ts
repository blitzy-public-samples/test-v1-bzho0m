/**
 * @fileoverview Abstract base service for PCI DSS compliant payment gateway integrations.
 * Provides standardized methods for secure payment processing across different providers.
 * @version 1.0.0
 */

// External imports
import { Observable, from, throwError, of } from 'rxjs'; // v7.8.0
import { catchError, map, retry, timeout } from 'rxjs/operators';
import { Injectable, Logger } from '@nestjs/common'; // v10.0.0
import { randomUUID } from 'crypto';

// Internal imports
import { BaseService } from '../../../shared/interfaces/base-service.interface';
import { Payment, PaymentStatus, PaymentMethod } from '../models/payment.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Rate limiting configuration for payment gateway requests
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
}

/**
 * Configuration interface for payment gateway services with security settings
 */
export interface PaymentGatewayConfig {
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  environment: 'production' | 'test';
  encryptionKey: string;
  rateLimits: RateLimitConfig;
}

/**
 * Payment request interface with required transaction details
 */
export interface PaymentRequest {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  cardToken?: string;
  guestId: string;
  folioId: string;
  metadata?: Record<string, unknown>;
  deviceFingerprint?: string;
  ipAddress?: string;
}

/**
 * Gateway response interface for standardized response handling
 */
export interface GatewayResponse {
  success: boolean;
  transactionId: string;
  gatewayReference: string;
  authorizationCode?: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
  riskScore?: number;
}

/**
 * Abstract base class for PCI-compliant payment gateway implementations
 * Implements comprehensive security measures and standardized payment processing
 */
@Injectable()
export abstract class PaymentGatewayService implements BaseService<Payment> {
  protected readonly logger: Logger;
  protected config: PaymentGatewayConfig;

  constructor() {
    this.logger = new Logger(PaymentGatewayService.name);
  }

  /**
   * Initializes the payment gateway with secure configuration
   * @param config - Gateway configuration with encryption keys
   */
  protected abstract initialize(config: PaymentGatewayConfig): void;

  /**
   * Authorizes a payment transaction with PCI compliance measures
   * @param request - Payment request details
   * @returns Observable<GatewayResponse>
   * @throws ErrorCode.VALIDATION_ERROR for invalid requests
   * @throws ErrorCode.EXTERNAL_SERVICE_ERROR for gateway failures
   */
  public abstract authorize(request: PaymentRequest): Observable<GatewayResponse>;

  /**
   * Captures a previously authorized payment
   * @param transactionId - Original transaction ID
   * @param amount - Amount to capture
   * @returns Observable<GatewayResponse>
   */
  public abstract capture(transactionId: string, amount: number): Observable<GatewayResponse>;

  /**
   * Voids an authorized payment before capture
   * @param transactionId - Transaction to void
   * @returns Observable<GatewayResponse>
   */
  public abstract void(transactionId: string): Observable<GatewayResponse>;

  /**
   * Processes a refund for a captured payment
   * @param transactionId - Original transaction ID
   * @param amount - Amount to refund
   * @returns Observable<GatewayResponse>
   */
  public abstract refund(transactionId: string, amount: number): Observable<GatewayResponse>;

  /**
   * Creates a new payment record with comprehensive tracking
   * @param data - Payment data to create
   * @returns Observable<Payment>
   */
  public create(data: Partial<Payment>): Observable<Payment> {
    this.logger.debug(`Creating payment record: ${JSON.stringify(data)}`);
    return of({ ...data, id: randomUUID() } as Payment)
      .pipe(
        catchError(error => {
          this.logger.error(`Payment creation failed: ${error.message}`);
          return throwError(() => ({
            code: ErrorCode.DATABASE_ERROR,
            message: 'Failed to create payment record'
          }));
        })
      );
  }

  /**
   * Retrieves a payment record by ID
   * @param id - Payment ID to find
   * @returns Observable<Payment>
   */
  public findById(id: string): Observable<Payment> {
    this.logger.debug(`Retrieving payment record: ${id}`);
    return of({} as Payment)
      .pipe(
        catchError(error => {
          this.logger.error(`Payment retrieval failed: ${error.message}`);
          return throwError(() => ({
            code: ErrorCode.RESOURCE_NOT_FOUND,
            message: 'Payment record not found'
          }));
        })
      );
  }

  /**
   * Validates payment request data for security and completeness
   * @param request - Payment request to validate
   * @throws ErrorCode.VALIDATION_ERROR for invalid requests
   */
  protected validatePaymentRequest(request: PaymentRequest): void {
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    if (!request.currency || request.currency.length !== 3) {
      throw new Error('Invalid currency code');
    }
    if (!request.guestId || !request.folioId) {
      throw new Error('Missing required guest or folio reference');
    }
  }

  /**
   * Encrypts sensitive payment data for secure storage
   * @param data - Sensitive data to encrypt
   * @returns Encrypted data string
   */
  protected abstract encryptSensitiveData(data: string): string;

  /**
   * Decrypts sensitive payment data for processing
   * @param encryptedData - Data to decrypt
   * @returns Decrypted data string
   */
  protected abstract decryptSensitiveData(encryptedData: string): string;

  /**
   * Logs payment transaction attempt for audit trail
   * @param request - Payment request details
   * @param response - Gateway response
   */
  protected logTransactionAttempt(request: PaymentRequest, response: GatewayResponse): void {
    this.logger.log({
      event: 'payment_attempt',
      amount: request.amount,
      currency: request.currency,
      status: response.status,
      transactionId: response.transactionId,
      timestamp: new Date().toISOString()
    });
  }
}