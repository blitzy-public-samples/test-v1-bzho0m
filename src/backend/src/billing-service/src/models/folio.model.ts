/**
 * @fileoverview Defines the Folio model for managing guest financial accounts including charges,
 * payments, and billing operations with support for multi-currency and split folios.
 * @version 1.0.0
 */

// External imports
import { Prisma } from '@prisma/client'; // v5.0.0 - For decimal type support in financial calculations

// Internal imports
import { BaseModel } from '../../../shared/interfaces/base-model.interface';

/**
 * Enum defining the possible states of a folio throughout its lifecycle
 * Used for tracking the processing status of guest accounts
 */
export enum FolioStatus {
  /** Folio is active and can accept charges/payments */
  OPEN = 'OPEN',
  /** Folio is awaiting review before closing (e.g., during night audit) */
  PENDING_REVIEW = 'PENDING_REVIEW',
  /** Folio has been closed and finalized */
  CLOSED = 'CLOSED',
  /** Folio has disputed charges under review */
  DISPUTED = 'DISPUTED',
  /** Folio charges have been transferred to another folio */
  TRANSFERRED = 'TRANSFERRED',
  /** Folio has been archived after closing period */
  ARCHIVED = 'ARCHIVED'
}

/**
 * Enum defining the possible states of a charge entry
 */
export enum ChargeStatus {
  /** Charge has been posted but not yet processed */
  PENDING = 'PENDING',
  /** Charge has been processed and approved */
  POSTED = 'POSTED',
  /** Charge has been voided */
  VOIDED = 'VOIDED',
  /** Charge is under dispute */
  DISPUTED = 'DISPUTED',
  /** Charge has been adjusted */
  ADJUSTED = 'ADJUSTED'
}

/**
 * Type definition for a charge entry in the folio
 * Includes detailed tracking of amounts, taxes, and departmental allocation
 */
export type FolioCharge = {
  /** Unique identifier for the charge */
  id: string;
  /** Description of the charge */
  description: string;
  /** Base amount of the charge before taxes */
  amount: Prisma.Decimal;
  /** Category of the charge (e.g., Room, F&B, etc.) */
  category: string;
  /** Department responsible for the charge */
  department: string;
  /** Date when the charge was posted */
  postingDate: Date;
  /** Tax rate applied to the charge */
  taxRate: Prisma.Decimal;
  /** Calculated tax amount */
  taxAmount: Prisma.Decimal;
  /** Total amount including taxes */
  totalAmount: Prisma.Decimal;
  /** Reference to the parent folio */
  folioId: string;
  /** Reference to associated invoice if any */
  invoiceId: string | null;
  /** Current status of the charge */
  status: ChargeStatus;
  /** External reference number if applicable */
  reference: string;
  /** Additional notes about the charge */
  notes: string;
};

/**
 * Type definition for a payment entry in the folio
 */
export type Payment = {
  /** Unique identifier for the payment */
  id: string;
  /** Amount of the payment */
  amount: Prisma.Decimal;
  /** Payment method used */
  method: string;
  /** Payment transaction reference */
  transactionRef: string;
  /** Date when payment was processed */
  processedDate: Date;
  /** Status of the payment */
  status: string;
  /** Reference to the parent folio */
  folioId: string;
};

/**
 * Type definition for an invoice generated from the folio
 */
export type Invoice = {
  /** Unique identifier for the invoice */
  id: string;
  /** Invoice number */
  invoiceNumber: string;
  /** Total amount of the invoice */
  totalAmount: Prisma.Decimal;
  /** Date when invoice was issued */
  issueDate: Date;
  /** Due date for the invoice */
  dueDate: Date;
  /** Current status of the invoice */
  status: string;
  /** Reference to the parent folio */
  folioId: string;
};

/**
 * Interface representing a guest's folio (billing account) with support for
 * multi-currency transactions, split folios, and detailed financial tracking
 */
export interface Folio extends BaseModel {
  /** Unique folio number for reference */
  folioNumber: string;
  /** Reference to the guest */
  guestId: string;
  /** Reference to the reservation */
  reservationId: string;
  /** Reference to the room if applicable */
  roomId: string;
  /** Current balance of the folio */
  balance: Prisma.Decimal;
  /** Currency of the folio */
  currency: string;
  /** Current status of the folio */
  status: FolioStatus;
  /** Date when the folio was opened */
  openDate: Date;
  /** Date when the folio was closed */
  closeDate: Date | null;
  /** Indicates if this is the main folio for a reservation */
  isMainFolio: boolean;
  /** Reference to parent folio if this is a split folio */
  parentFolioId: string | null;
  /** Collection of charges on this folio */
  charges: FolioCharge[];
  /** Collection of payments on this folio */
  payments: Payment[];
  /** Collection of invoices generated for this folio */
  invoices: Invoice[];
  /** Additional notes about the folio */
  notes: string;
}

/**
 * Type for creating a new folio with required fields
 */
export type CreateFolioDTO = Omit<Folio, keyof BaseModel | 'charges' | 'payments' | 'invoices'>;

/**
 * Type for updating an existing folio
 */
export type UpdateFolioDTO = Partial<CreateFolioDTO>;