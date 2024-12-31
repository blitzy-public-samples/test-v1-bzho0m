/**
 * @fileoverview Defines comprehensive TypeScript interfaces for billing operations
 * in the hotel management system, ensuring PCI DSS compliance and supporting
 * all financial transaction types.
 * @version 1.0.0
 */

import { BaseModel } from '../../../shared/interfaces/base-model.interface';

/**
 * ISO 4217 currency code type with validation pattern
 */
export type CurrencyCode = string; // Matches pattern ^[A-Z]{3}$

/**
 * PCI DSS compliant card number mask type
 */
export type CardMask = string; // Last 4 digits only, pattern ^\\d{4}$

/**
 * Comprehensive list of supported payment methods
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
 * Extended payment transaction status states
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
 * Comprehensive invoice status states
 */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID',
  IN_DISPUTE = 'IN_DISPUTE',
  WRITTEN_OFF = 'WRITTEN_OFF'
}

/**
 * Extended folio status states including night audit process
 */
export enum FolioStatus {
  OPEN = 'OPEN',
  PENDING_REVIEW = 'PENDING_REVIEW',
  CLOSED = 'CLOSED',
  DISPUTED = 'DISPUTED',
  TRANSFERRED = 'TRANSFERRED',
  ARCHIVED = 'ARCHIVED',
  PENDING_NIGHT_AUDIT = 'PENDING_NIGHT_AUDIT',
  AUDIT_COMPLETED = 'AUDIT_COMPLETED'
}

/**
 * Standardized payment gateway response interface
 */
export interface IPaymentGatewayResponse {
  /**
   * Unique transaction identifier from payment gateway
   */
  gatewayTransactionId: string;

  /**
   * Authorization code from payment processor
   */
  authorizationCode: string;

  /**
   * Standardized response code from gateway
   */
  responseCode: string;

  /**
   * Human-readable response message
   */
  responseMessage: string;

  /**
   * Additional metadata from gateway (optional)
   */
  metadata?: Record<string, unknown>;
}

/**
 * PCI DSS compliant payment transaction interface
 */
export interface IPayment extends BaseModel {
  /**
   * Unique transaction identifier from payment gateway
   */
  transactionId: string;

  /**
   * Reference to associated folio
   */
  folioId: string;

  /**
   * Payment amount with precision to 4 decimal places
   */
  amount: number;

  /**
   * ISO 4217 currency code
   */
  currency: CurrencyCode;

  /**
   * Payment method used
   */
  method: PaymentMethod;

  /**
   * Current payment status
   */
  status: PaymentStatus;

  /**
   * PCI compliant masked card number (last 4 digits only)
   */
  cardLastFour?: CardMask;

  /**
   * Card type identifier (when applicable)
   */
  cardType?: string;

  /**
   * Detailed gateway response
   */
  gatewayResponse: IPaymentGatewayResponse;

  /**
   * Reference to original payment for refunds/chargebacks
   */
  originalPaymentId?: string;

  /**
   * Additional payment metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for invoice line items
 */
export interface IInvoiceLineItem {
  /**
   * Line item description
   */
  description: string;

  /**
   * Quantity of items
   */
  quantity: number;

  /**
   * Unit price
   */
  unitPrice: number;

  /**
   * Total amount for line item
   */
  totalAmount: number;

  /**
   * Tax rate applied
   */
  taxRate: number;

  /**
   * Tax amount calculated
   */
  taxAmount: number;

  /**
   * Line item category/type
   */
  category: string;

  /**
   * Reference to related service/product
   */
  referenceId?: string;
}

/**
 * Comprehensive invoice interface
 */
export interface IInvoice extends BaseModel {
  /**
   * Invoice number
   */
  invoiceNumber: string;

  /**
   * Reference to associated folio
   */
  folioId: string;

  /**
   * Invoice issue date
   */
  issueDate: Date;

  /**
   * Invoice due date
   */
  dueDate: Date;

  /**
   * Current invoice status
   */
  status: InvoiceStatus;

  /**
   * Invoice line items
   */
  lineItems: IInvoiceLineItem[];

  /**
   * Subtotal amount
   */
  subtotalAmount: number;

  /**
   * Total tax amount
   */
  taxAmount: number;

  /**
   * Total amount including tax
   */
  totalAmount: number;

  /**
   * Amount paid
   */
  paidAmount: number;

  /**
   * Outstanding balance
   */
  balanceAmount: number;

  /**
   * Currency code
   */
  currency: CurrencyCode;

  /**
   * Notes/comments on invoice
   */
  notes?: string;
}

/**
 * Guest folio interface for tracking all financial transactions
 */
export interface IFolio extends BaseModel {
  /**
   * Reference to guest
   */
  guestId: string;

  /**
   * Reference to reservation
   */
  reservationId: string;

  /**
   * Current folio status
   */
  status: FolioStatus;

  /**
   * Running balance
   */
  balance: number;

  /**
   * Currency code
   */
  currency: CurrencyCode;

  /**
   * Associated payments
   */
  payments: IPayment[];

  /**
   * Associated invoices
   */
  invoices: IInvoice[];

  /**
   * Night audit status
   */
  lastAuditDate?: Date;

  /**
   * Notes/comments on folio
   */
  notes?: string;
}