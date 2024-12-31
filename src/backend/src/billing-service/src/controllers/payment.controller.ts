/**
 * @fileoverview Payment controller implementing PCI DSS compliant payment processing
 * with comprehensive security measures and error handling.
 * @version 1.0.0
 */

// External imports
import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { Injectable, Controller, UseGuards, RateLimit } from '@nestjs/common'; // v10.0.0
import * as Joi from 'joi'; // v17.9.0
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// Internal imports
import { BaseController, RequestWithUser, ApiResponse } from '../../../shared/interfaces/base-controller.interface';
import { Payment, PaymentStatus, PaymentMethod, SafePayment, toSafePayment } from '../models/payment.model';
import { PaymentGatewayService, PaymentRequest, GatewayResponse } from '../services/payment-gateway.service';
import { ErrorCode, createErrorDetails } from '../../../shared/constants/error-codes';

/**
 * Payment validation schema enforcing PCI DSS compliance
 */
const paymentValidationSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).required(),
  paymentMethod: Joi.string().valid(...Object.values(PaymentMethod)).required(),
  cardToken: Joi.string().when('paymentMethod', {
    is: PaymentMethod.CREDIT_CARD,
    then: Joi.required()
  }),
  folioId: Joi.string().uuid().required(),
  metadata: Joi.object().optional()
});

/**
 * Rate limiting configuration for payment endpoints
 */
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
};

/**
 * Controller handling secure payment processing with PCI DSS compliance
 * @implements {BaseController<Payment>}
 */
@Injectable()
@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentController implements BaseController<Payment> {
  constructor(
    private readonly paymentGatewayService: PaymentGatewayService
  ) {}

  /**
   * Process new payment transaction with enhanced security
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @returns {Promise<void>} HTTP response with payment result
   */
  @RateLimit(RATE_LIMIT_CONFIG)
  async create(req: RequestWithUser, res: Response): Promise<void> {
    try {
      // Validate request data
      const { error, value } = paymentValidationSchema.validate(req.body);
      if (error) {
        const errorDetails = createErrorDetails(
          ErrorCode.VALIDATION_ERROR,
          { details: error.details },
          req.path
        );
        res.status(400).json({ success: false, error: errorDetails });
        return;
      }

      // Prepare payment request with security measures
      const paymentRequest: PaymentRequest = {
        ...value,
        guestId: req.user.id,
        deviceFingerprint: req.headers['x-device-id'] as string,
        ipAddress: req.ip
      };

      // Process payment through gateway
      this.paymentGatewayService.authorize(paymentRequest)
        .pipe(
          map((gatewayResponse: GatewayResponse) => {
            // Create payment record if authorized
            if (gatewayResponse.success) {
              return this.paymentGatewayService.create({
                transactionId: gatewayResponse.transactionId,
                gatewayReference: gatewayResponse.gatewayReference,
                status: gatewayResponse.status,
                authorizationCode: gatewayResponse.authorizationCode,
                riskScore: gatewayResponse.riskScore,
                ...paymentRequest
              });
            }
            throw new Error(gatewayResponse.errorMessage);
          }),
          map((payment: Payment) => toSafePayment(payment)),
          catchError(error => {
            throw createErrorDetails(
              ErrorCode.EXTERNAL_SERVICE_ERROR,
              { message: error.message },
              req.path
            );
          })
        )
        .subscribe({
          next: (safePayment: SafePayment) => {
            res.status(201).json({ success: true, data: safePayment });
          },
          error: (error) => {
            res.status(500).json({ success: false, error });
          }
        });
    } catch (error) {
      const errorDetails = createErrorDetails(
        ErrorCode.INTERNAL_SERVER_ERROR,
        { message: error.message },
        req.path
      );
      res.status(500).json({ success: false, error: errorDetails });
    }
  }

  /**
   * Retrieve filtered payments with pagination
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   */
  async findAll(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as PaymentStatus;

      const payments = await this.paymentGatewayService.findAll({ status })
        .pipe(
          map(payments => payments.map(toSafePayment)),
          catchError(error => {
            throw createErrorDetails(
              ErrorCode.DATABASE_ERROR,
              { message: error.message },
              req.path
            );
          })
        )
        .toPromise();

      res.status(200).json({
        success: true,
        data: payments,
        pagination: {
          page,
          limit,
          total: payments.length,
          totalPages: Math.ceil(payments.length / limit)
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error });
    }
  }

  /**
   * Process payment refund with validation
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   */
  @RateLimit(RATE_LIMIT_CONFIG)
  async refund(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { transactionId, amount } = req.body;

      // Validate refund request
      if (!transactionId || !amount) {
        throw createErrorDetails(
          ErrorCode.VALIDATION_ERROR,
          { message: 'Transaction ID and amount are required' },
          req.path
        );
      }

      // Process refund through gateway
      this.paymentGatewayService.refund(transactionId, amount)
        .pipe(
          map((gatewayResponse: GatewayResponse) => {
            if (!gatewayResponse.success) {
              throw new Error(gatewayResponse.errorMessage);
            }
            return gatewayResponse;
          }),
          catchError(error => {
            throw createErrorDetails(
              ErrorCode.EXTERNAL_SERVICE_ERROR,
              { message: error.message },
              req.path
            );
          })
        )
        .subscribe({
          next: (response) => {
            res.status(200).json({ success: true, data: response });
          },
          error: (error) => {
            res.status(500).json({ success: false, error });
          }
        });
    } catch (error) {
      res.status(500).json({ success: false, error });
    }
  }
}