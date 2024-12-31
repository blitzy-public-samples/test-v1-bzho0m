/**
 * @fileoverview Defines the Invoice model and related types for the billing service,
 * handling comprehensive financial record-keeping and guest billing operations.
 * @version 1.0.0
 */

// External imports - v5.0.0
import { Prisma } from '@prisma/client';

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';

/**
 * Enum defining all possible states of an invoice throughout its lifecycle
 * @enum {string}
 */
export enum InvoiceStatus {
  /** Initial state when invoice is being prepared */
  DRAFT = 'DRAFT',
  /** Invoice has been formally issued to the guest */
  ISSUED = 'ISSUED',
  /** Partial payment has been received */
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  /** Full payment has been received */
  PAID = 'PAID',
  /** Payment is past due date */
  OVERDUE = 'OVERDUE',
  /** Invoice has been cancelled before payment */
  CANCELLED = 'CANCELLED',
  /** Invoice has been voided after issuance */
  VOID = 'VOID',
  /** Full refund has been processed */
  REFUNDED = 'REFUNDED',
  /** Payment is under dispute */
  DISPUTED = 'DISPUTED',
  /** Invoice has been sent to collections */
  COLLECTION = 'COLLECTION'
}

/**
 * Represents a detailed line item in an invoice with comprehensive financial tracking
 * @typedef {Object} InvoiceItem
 */
export type InvoiceItem = {
  /** Unique identifier for the invoice item */
  id: string;
  /** Reference to parent invoice */
  invoiceId: string;
  /** Detailed description of the charged item or service */
  description: string;
  /** Quantity of items or services */
  quantity: number;
  /** Price per unit in the invoice currency */
  unitPrice: Prisma.Decimal;
  /** Applicable tax rate as a decimal */
  taxRate: Prisma.Decimal;
  /** Calculated tax amount */
  taxAmount: Prisma.Decimal;
  /** Total amount including tax */
  totalAmount: Prisma.Decimal;
  /** Reference to original folio charge */
  folioChargeId: string;
  /** Service category for reporting */
  category: string;
  /** Department responsible for the charge */
  department: string;
  /** Date when service was provided */
  serviceDate: Date;
  /** Tax category for compliance reporting */
  taxCategory: string;
  /** Applied discount amount */
  discountAmount: Prisma.Decimal;
  /** Indicates if item can be refunded */
  isRefundable: boolean;
  /** External reference number if applicable */
  reference: string;
};

/**
 * Type definition for payment records associated with an invoice
 * @typedef {Object} Payment
 */
export type Payment = {
  /** Unique identifier for the payment */
  id: string;
  /** Reference to the invoice */
  invoiceId: string;
  /** Amount paid */
  amount: Prisma.Decimal;
  /** Payment method used */
  method: string;
  /** Payment transaction reference */
  transactionId: string;
  /** Date payment was processed */
  paymentDate: Date;
  /** Payment processor reference */
  processorReference: string;
  /** Payment status */
  status: string;
};

/**
 * Interface representing a formal billing document with comprehensive financial tracking.
 * Implements BaseModel for consistent entity lifecycle management.
 * @interface Invoice
 * @extends {BaseModel}
 */
export interface Invoice extends BaseModel {
  /** Unique identifier inherited from BaseModel */
  id: string;
  
  /** Sequential invoice number for business reference */
  invoiceNumber: string;
  
  /** Reference to the guest folio */
  folioId: string;
  
  /** Reference to the guest */
  guestId: string;
  
  /** Reference to the reservation */
  reservationId: string;
  
  /** Subtotal amount before tax */
  subtotal: Prisma.Decimal;
  
  /** Total tax amount */
  taxAmount: Prisma.Decimal;
  
  /** Total amount including tax */
  totalAmount: Prisma.Decimal;
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Exchange rate at time of invoice creation */
  exchangeRate: Prisma.Decimal;
  
  /** Current status of the invoice */
  status: InvoiceStatus;
  
  /** Date when invoice was issued */
  issueDate: Date;
  
  /** Payment due date */
  dueDate: Date;
  
  /** Date when full payment was received */
  paidDate: Date | null;
  
  /** Detailed line items */
  items: InvoiceItem[];
  
  /** Payment records */
  payments: Payment[];
  
  /** Additional notes or comments */
  notes: string;
  
  /** Complete billing address */
  billingAddress: string;
  
  /** Tax identification number */
  taxIdentifier: string;
  
  /** Company name for business guests */
  companyName: string;
  
  /** VAT registration number */
  vatNumber: string;
  
  /** Indicates if this is a pro-forma invoice */
  isProformaInvoice: boolean;
  
  /** Payment terms and conditions */
  paymentTerms: string;
  
  /** Creation timestamp inherited from BaseModel */
  createdAt: Date;
  
  /** Last update timestamp inherited from BaseModel */
  updatedAt: Date;
  
  /** Soft delete timestamp inherited from BaseModel */
  deletedAt: Date | null;
}

/**
 * Type guard to check if an object is a valid Invoice
 * @param {any} obj - Object to check
 * @returns {obj is Invoice} - Type predicate
 */
export function isInvoice(obj: any): obj is Invoice {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.invoiceNumber === 'string' &&
    typeof obj.folioId === 'string' &&
    typeof obj.guestId === 'string' &&
    obj.status in InvoiceStatus &&
    obj.items instanceof Array &&
    obj.payments instanceof Array
  );
}