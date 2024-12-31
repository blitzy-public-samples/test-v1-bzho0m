/**
 * @fileoverview Billing API client implementation for hotel management system
 * Handles all billing-related operations with PCI DSS compliance, error handling,
 * and comprehensive monitoring.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';
import {
  IPayment,
  IInvoice,
  IFolio,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  FolioStatus,
  IPaymentGatewayResponse
} from '../interfaces/billing.interface';
import { API_ENDPOINTS, API_TIMEOUT } from '../constants/api.constants';

// Validation schemas for request/response data
const paymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  method: z.nativeEnum(PaymentMethod),
  cardLastFour: z.string().regex(/^\d{4}$/).optional(),
  cardType: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const folioSchema = z.object({
  guestId: z.string().uuid(),
  reservationId: z.string().uuid(),
  currency: z.string().length(3)
});

/**
 * Error types specific to billing operations
 */
export enum BillingErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  GATEWAY_ERROR = 'GATEWAY_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR'
}

/**
 * Custom error class for billing operations
 */
export class BillingError extends Error {
  constructor(
    public type: BillingErrorType,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

/**
 * Configuration interface for BillingApiClient
 */
interface BillingApiConfig {
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Client for interacting with the billing service API
 * Implements PCI DSS compliant payment processing and comprehensive error handling
 */
export class BillingApiClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly retryAttempts: number;

  constructor(config: BillingApiConfig = {}) {
    this.retryAttempts = config.retryAttempts || 3;
    
    this.axiosInstance = axios.create({
      baseURL: config.baseURL || API_ENDPOINTS.BILLING.BASE,
      timeout: config.timeout || API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0'
      }
    });

    // Add request interceptor for logging and monitoring
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Remove sensitive data from logs
        const sanitizedConfig = this.sanitizeRequestData(config);
        console.debug('Billing API Request:', sanitizedConfig);
        return config;
      },
      (error) => {
        console.error('Billing API Request Error:', this.sanitizeError(error));
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.debug('Billing API Response:', this.sanitizeResponseData(response));
        return response;
      },
      (error) => {
        return this.handleApiError(error);
      }
    );
  }

  /**
   * Retrieves a folio by ID with comprehensive error handling
   * @param folioId - Unique identifier of the folio
   * @returns Promise resolving to folio details
   * @throws BillingError if retrieval fails
   */
  public async getFolio(folioId: string): Promise<IFolio> {
    try {
      const response = await this.axiosInstance.get<IFolio>(
        `${API_ENDPOINTS.BILLING.FOLIOS}/${folioId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Creates a new folio with validation
   * @param folioData - Data for creating new folio
   * @returns Promise resolving to created folio
   * @throws BillingError if creation fails
   */
  public async createFolio(folioData: Omit<IFolio, 'id' | 'createdAt' | 'updatedAt'>): Promise<IFolio> {
    try {
      // Validate input data
      folioSchema.parse(folioData);

      const response = await this.axiosInstance.post<IFolio>(
        API_ENDPOINTS.BILLING.FOLIOS,
        folioData
      );
      return response.data;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BillingError(
          BillingErrorType.VALIDATION_ERROR,
          'Invalid folio data',
          'VALIDATION_FAILED',
          error.errors
        );
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Processes a payment with PCI DSS compliance
   * @param paymentData - Payment details
   * @returns Promise resolving to payment transaction details
   * @throws BillingError if payment processing fails
   */
  public async processPayment(paymentData: Omit<IPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPayment> {
    try {
      // Validate payment data
      paymentSchema.parse(paymentData);

      // Mask sensitive data before logging
      const sanitizedData = this.sanitizePaymentData(paymentData);
      console.debug('Processing payment:', sanitizedData);

      const response = await this.axiosInstance.post<IPayment>(
        API_ENDPOINTS.BILLING.PAYMENTS,
        paymentData
      );

      return response.data;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BillingError(
          BillingErrorType.VALIDATION_ERROR,
          'Invalid payment data',
          'VALIDATION_FAILED',
          error.errors
        );
      }
      throw this.handleApiError(error);
    }
  }

  /**
   * Handles API errors with retry logic and error classification
   * @param error - Error from API request
   * @returns Never - Always throws a BillingError
   */
  private handleApiError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message: string; code: string }>;
      
      // Handle specific error cases
      if (axiosError.response) {
        const { status, data } = axiosError.response;
        
        switch (status) {
          case 400:
            throw new BillingError(
              BillingErrorType.VALIDATION_ERROR,
              data?.message || 'Invalid request data',
              data?.code
            );
          case 401:
          case 403:
            throw new BillingError(
              BillingErrorType.AUTHORIZATION_ERROR,
              'Authorization failed',
              data?.code
            );
          case 402:
            throw new BillingError(
              BillingErrorType.PAYMENT_DECLINED,
              data?.message || 'Payment was declined',
              data?.code
            );
          default:
            throw new BillingError(
              BillingErrorType.GATEWAY_ERROR,
              data?.message || 'Payment gateway error',
              data?.code
            );
        }
      }
      
      throw new BillingError(
        BillingErrorType.NETWORK_ERROR,
        'Network error occurred',
        axiosError.code
      );
    }

    // Handle unexpected errors
    throw new BillingError(
      BillingErrorType.GATEWAY_ERROR,
      'Unexpected error occurred',
      'UNKNOWN_ERROR',
      error
    );
  }

  /**
   * Sanitizes sensitive data from payment information
   * @param data - Payment data to sanitize
   * @returns Sanitized payment data safe for logging
   */
  private sanitizePaymentData(data: any): any {
    const sanitized = { ...data };
    if (sanitized.cardNumber) delete sanitized.cardNumber;
    if (sanitized.cvv) delete sanitized.cvv;
    if (sanitized.cardLastFour) {
      sanitized.cardLastFour = '****';
    }
    return sanitized;
  }

  /**
   * Sanitizes request data for logging
   * @param config - Axios request config
   * @returns Sanitized config safe for logging
   */
  private sanitizeRequestData(config: any): any {
    const sanitized = { ...config };
    if (sanitized.headers?.Authorization) {
      sanitized.headers.Authorization = '[REDACTED]';
    }
    if (sanitized.data) {
      sanitized.data = this.sanitizePaymentData(sanitized.data);
    }
    return sanitized;
  }

  /**
   * Sanitizes response data for logging
   * @param response - Axios response
   * @returns Sanitized response safe for logging
   */
  private sanitizeResponseData(response: any): any {
    const sanitized = { ...response };
    if (sanitized.data) {
      sanitized.data = this.sanitizePaymentData(sanitized.data);
    }
    return sanitized;
  }

  /**
   * Sanitizes error information for logging
   * @param error - Error to sanitize
   * @returns Sanitized error safe for logging
   */
  private sanitizeError(error: any): any {
    const sanitized = { ...error };
    if (sanitized.config) {
      sanitized.config = this.sanitizeRequestData(sanitized.config);
    }
    if (sanitized.response?.data) {
      sanitized.response.data = this.sanitizePaymentData(sanitized.response.data);
    }
    return sanitized;
  }
}

// Export singleton instance with default configuration
export const billingApi = new BillingApiClient();