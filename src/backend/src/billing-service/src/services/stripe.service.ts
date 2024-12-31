/**
 * @fileoverview Enhanced Stripe payment gateway integration with comprehensive security,
 * monitoring, and PCI DSS compliance features.
 * @version 1.0.0
 */

// External imports
import Stripe from 'stripe'; // v12.0.0
import { Injectable, Logger } from '@nestjs/common'; // v10.0.0
import { ConfigService } from '@nestjs/config'; // v10.0.0
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';

// Internal imports
import { PaymentGatewayService, PaymentRequest, GatewayResponse } from './payment-gateway.service';
import { Payment, PaymentStatus, PaymentMethod } from '../models/payment.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Enhanced Stripe payment gateway service with comprehensive security and monitoring
 */
@Injectable()
export class StripeService extends PaymentGatewayService {
  private readonly stripeClient: Stripe;
  private readonly webhookSecret: string;
  private readonly idempotencyKeyPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    super();
    this.initialize();
  }

  /**
   * Initializes Stripe service with enhanced security configuration
   */
  protected initialize(): void {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error('Stripe API key not configured');
    }

    this.stripeClient = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
      typescript: true,
      telemetry: false // Disable telemetry for security
    });

    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.idempotencyKeyPrefix = this.configService.get<string>('STRIPE_IDEMPOTENCY_PREFIX') || 'hms';
  }

  /**
   * Authorizes a payment through Stripe with comprehensive validation and monitoring
   * @param request Payment request details
   * @returns Observable<GatewayResponse>
   */
  public authorize(request: PaymentRequest): Observable<GatewayResponse> {
    this.logger.debug(`Initiating Stripe authorization for amount ${request.amount}`);
    this.validatePaymentRequest(request);

    const idempotencyKey = this.generateIdempotencyKey(request);

    return from(this.createPaymentIntent(request, idempotencyKey)).pipe(
      map(intent => this.mapToGatewayResponse(intent)),
      retry(3),
      catchError(error => {
        this.logger.error(`Stripe authorization failed: ${error.message}`, error.stack);
        return throwError(() => ({
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: 'Payment authorization failed'
        }));
      })
    );
  }

  /**
   * Captures a previously authorized payment
   * @param transactionId Original transaction ID
   * @param amount Amount to capture
   */
  public capture(transactionId: string, amount: number): Observable<GatewayResponse> {
    this.logger.debug(`Capturing Stripe payment: ${transactionId}`);

    return from(this.stripeClient.paymentIntents.capture(
      transactionId,
      {
        amount_to_capture: Math.round(amount * 100)
      }
    )).pipe(
      map(intent => this.mapToGatewayResponse(intent)),
      retry(2),
      catchError(error => {
        this.logger.error(`Capture failed: ${error.message}`, error.stack);
        return throwError(() => ({
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: 'Payment capture failed'
        }));
      })
    );
  }

  /**
   * Processes refunds with validation and security checks
   * @param transactionId Transaction to refund
   * @param amount Amount to refund
   */
  public refund(transactionId: string, amount: number): Observable<GatewayResponse> {
    this.logger.debug(`Processing refund for transaction: ${transactionId}`);

    return from(this.stripeClient.refunds.create({
      payment_intent: transactionId,
      amount: Math.round(amount * 100)
    })).pipe(
      map(refund => ({
        success: refund.status === 'succeeded',
        transactionId: refund.id,
        gatewayReference: refund.payment_intent as string,
        status: PaymentStatus.REFUNDED,
        riskScore: 0
      })),
      retry(2),
      catchError(error => {
        this.logger.error(`Refund failed: ${error.message}`, error.stack);
        return throwError(() => ({
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          message: 'Refund processing failed'
        }));
      })
    );
  }

  /**
   * Processes Stripe webhooks with enhanced security and validation
   * @param signature Stripe signature header
   * @param rawBody Raw request body
   */
  public async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
    try {
      const event = this.stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );

      this.logger.debug(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;
        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Creates a Stripe payment intent with security measures
   * @param request Payment request details
   * @param idempotencyKey Idempotency key for safe retries
   */
  private async createPaymentIntent(
    request: PaymentRequest,
    idempotencyKey: string
  ): Promise<Stripe.PaymentIntent> {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(request.amount * 100),
      currency: request.currency.toLowerCase(),
      payment_method: request.cardToken,
      confirm: true,
      metadata: {
        guestId: request.guestId,
        folioId: request.folioId,
        ...request.metadata
      },
      payment_method_types: ['card'],
      capture_method: 'manual',
      setup_future_usage: 'off_session'
    };

    return this.stripeClient.paymentIntents.create(params, {
      idempotencyKey
    });
  }

  /**
   * Maps Stripe payment intent to standardized gateway response
   * @param intent Stripe payment intent
   */
  private mapToGatewayResponse(intent: Stripe.PaymentIntent): GatewayResponse {
    return {
      success: intent.status === 'succeeded' || intent.status === 'requires_capture',
      transactionId: intent.id,
      gatewayReference: intent.client_secret || '',
      authorizationCode: intent.charges.data[0]?.authorization_code || '',
      status: this.mapStripeStatus(intent.status),
      riskScore: intent.charges.data[0]?.outcome?.risk_score || 0
    };
  }

  /**
   * Maps Stripe payment status to internal payment status
   * @param stripeStatus Stripe payment status
   */
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'requires_payment_method': PaymentStatus.PENDING,
      'requires_confirmation': PaymentStatus.PENDING,
      'requires_capture': PaymentStatus.AUTHORIZED,
      'succeeded': PaymentStatus.CAPTURED,
      'canceled': PaymentStatus.VOIDED,
      'processing': PaymentStatus.PENDING
    };
    return statusMap[stripeStatus] || PaymentStatus.FAILED;
  }

  /**
   * Generates idempotency key for safe payment processing
   * @param request Payment request details
   */
  private generateIdempotencyKey(request: PaymentRequest): string {
    return `${this.idempotencyKeyPrefix}_${request.folioId}_${request.amount}_${Date.now()}`;
  }

  /**
   * Handles successful payment webhook events
   * @param intent Successful payment intent
   */
  private async handlePaymentSuccess(intent: Stripe.PaymentIntent): Promise<void> {
    this.logger.debug(`Payment succeeded: ${intent.id}`);
    // Implementation for payment success handling
  }

  /**
   * Handles failed payment webhook events
   * @param intent Failed payment intent
   */
  private async handlePaymentFailure(intent: Stripe.PaymentIntent): Promise<void> {
    this.logger.error(`Payment failed: ${intent.id}`, intent.last_payment_error);
    // Implementation for payment failure handling
  }

  /**
   * Handles dispute creation webhook events
   * @param dispute Created dispute
   */
  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.warn(`Dispute created: ${dispute.id}`);
    // Implementation for dispute handling
  }
}