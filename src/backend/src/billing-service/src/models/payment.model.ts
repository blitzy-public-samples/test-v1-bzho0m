/**
 * @fileoverview Payment model definition implementing PCI DSS compliant payment processing
 * with multi-gateway support and comprehensive transaction tracking.
 * @version 1.0.0
 * @requires @prisma/client v5.0.0
 */

import { BaseModel } from '../../../shared/interfaces/base-model.interface';
import { Prisma } from '@prisma/client'; // v5.0.0

/**
 * Supported payment methods including traditional and modern payment technologies
 */
export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  DIRECT_BILLING = 'DIRECT_BILLING',
  GIFT_CARD = 'GIFT_CARD',
  CRYPTO = 'CRYPTO',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT'
}

/**
 * Comprehensive payment status tracking including dispute handling
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  VOIDED = 'VOIDED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  DISPUTED = 'DISPUTED',
  CHARGEBACK_INITIATED = 'CHARGEBACK_INITIATED',
  CHARGEBACK_RESOLVED = 'CHARGEBACK_RESOLVED'
}

/**
 * Supported payment gateway providers with extensibility options
 */
export enum PaymentGateway {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  SQUARE = 'SQUARE',
  ADYEN = 'ADYEN',
  WORLDPAY = 'WORLDPAY',
  MANUAL = 'MANUAL',
  CUSTOM = 'CUSTOM'
}

/**
 * PCI DSS compliant payment transaction interface with comprehensive tracking
 * and security measures for payment processing.
 * 
 * @implements {BaseModel}
 */
export interface Payment extends BaseModel {
  /**
   * Unique transaction identifier from payment gateway
   * @type {string}
   */
  transactionId: string;

  /**
   * Reference to associated guest folio
   * @type {UUID}
   */
  folioId: UUID;

  /**
   * Reference to guest making payment
   * @type {UUID}
   */
  guestId: UUID;

  /**
   * Transaction amount with high precision decimal
   * @type {Prisma.Decimal}
   */
  amount: Prisma.Decimal;

  /**
   * ISO 4217 currency code
   * @type {string}
   */
  currency: string;

  /**
   * Payment method used for transaction
   * @type {PaymentMethod}
   */
  method: PaymentMethod;

  /**
   * Current transaction status
   * @type {PaymentStatus}
   */
  status: PaymentStatus;

  /**
   * Payment gateway provider
   * @type {PaymentGateway}
   */
  gateway: PaymentGateway;

  /**
   * Gateway-specific reference ID
   * @type {string}
   */
  gatewayReference: string;

  /**
   * Payment authorization code
   * @type {string}
   */
  authorizationCode: string;

  /**
   * Encrypted payment method token (PCI DSS compliant)
   * @type {string}
   */
  cardToken: string;

  /**
   * Last four digits of payment card (PCI DSS compliant display)
   * @type {string}
   */
  cardLastFour: string;

  /**
   * Card brand or type
   * @type {string}
   */
  cardType: string;

  /**
   * Card expiration month (1-12)
   * @type {number}
   */
  cardExpiryMonth: number;

  /**
   * Card expiration year
   * @type {number}
   */
  cardExpiryYear: number;

  /**
   * Total amount refunded from transaction
   * @type {Prisma.Decimal}
   */
  refundedAmount: Prisma.Decimal;

  /**
   * Additional encrypted payment metadata
   * @type {Prisma.JsonValue}
   */
  metadata: Prisma.JsonValue;

  /**
   * Internal payment notes
   * @type {string}
   */
  notes: string;

  /**
   * Transaction risk assessment score
   * @type {number}
   */
  riskScore: number;

  /**
   * Transaction IP address for fraud detection
   * @type {string}
   */
  ipAddress: string;

  /**
   * Device identification for fraud prevention
   * @type {string}
   */
  deviceFingerprint: string;
}

/**
 * Type for safe payment information exposure
 * Excludes sensitive payment data in accordance with PCI DSS
 */
export type SafePayment = Pick<Payment, 
  'id' | 
  'transactionId' | 
  'amount' | 
  'currency' | 
  'status' | 
  'createdAt' | 
  'updatedAt'
>;

/**
 * Type guard to ensure safe payment data exposure
 * @param payment - Full payment object
 * @returns SafePayment object with sensitive data removed
 */
export function toSafePayment(payment: Payment): SafePayment {
  return {
    id: payment.id,
    transactionId: payment.transactionId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}