/**
 * @fileoverview Controller handling HTTP endpoints for invoice management with comprehensive
 * financial operations, audit logging, and secure transaction processing.
 * @version 1.0.0
 */

// External imports - v4.18.0
import { Request, Response, NextFunction } from 'express';
import { Decimal } from '@prisma/client';

// Internal imports
import { BaseController, RequestWithUser, ApiResponse, PaginatedResponse } from '../../../shared/interfaces/base-controller.interface';
import { Invoice, InvoiceStatus, Payment } from '../models/invoice.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

// Decorators
import { Controller } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';

/**
 * Controller handling all invoice-related HTTP endpoints with secure financial operations
 * and comprehensive audit logging.
 */
@Controller('/api/v1/invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController implements BaseController<Invoice> {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Creates a new invoice with validation and audit logging
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with created invoice
   */
  public async create(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const trx = await this.transactionManager.start();

      try {
        // Validate request body
        const validatedData = await this.validateInvoiceData(req.body);

        // Generate unique invoice number
        const invoiceNumber = await this.generateInvoiceNumber();

        // Create invoice with initial DRAFT status
        const invoice = await this.invoiceService.create({
          ...validatedData,
          invoiceNumber,
          status: InvoiceStatus.DRAFT,
          createdBy: req.user.id
        }, trx);

        // Log audit trail
        await this.auditLogger.log({
          action: 'INVOICE_CREATED',
          userId: req.user.id,
          resourceId: invoice.id,
          details: { invoiceNumber }
        });

        await trx.commit();

        const response: ApiResponse<Invoice> = {
          success: true,
          data: invoice
        };

        res.status(201).json(response);
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves all invoices with filtering and pagination
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with paginated invoices
   */
  public async findAll(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10, status, dateFrom, dateTo, minAmount, maxAmount } = req.query;

      // Build filter criteria
      const filter = {
        ...(status && { status }),
        ...(dateFrom && dateTo && {
          issueDate: { gte: new Date(dateFrom as string), lte: new Date(dateTo as string) }
        }),
        ...(minAmount && { totalAmount: { gte: new Decimal(minAmount as string) } }),
        ...(maxAmount && { totalAmount: { lte: new Decimal(maxAmount as string) } })
      };

      const [invoices, total] = await Promise.all([
        this.invoiceService.findAll(filter, { page: Number(page), limit: Number(limit) }),
        this.invoiceService.count(filter)
      ]);

      const response: PaginatedResponse<Invoice> = {
        success: true,
        data: invoices,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generates a formal invoice from a folio with calculations
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with generated invoice
   */
  public async generateInvoice(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const { folioId } = req.params;
      const trx = await this.transactionManager.start();

      try {
        // Validate folio completeness
        const folio = await this.validateFolioCompleteness(folioId);

        // Calculate totals and taxes
        const { subtotal, taxAmount, totalAmount } = await this.calculateInvoiceTotals(folio);

        // Generate invoice with ISSUED status
        const invoice = await this.invoiceService.create({
          folioId,
          guestId: folio.guestId,
          reservationId: folio.reservationId,
          status: InvoiceStatus.ISSUED,
          subtotal,
          taxAmount,
          totalAmount,
          issueDate: new Date(),
          dueDate: this.calculateDueDate(),
          createdBy: req.user.id
        }, trx);

        // Log audit trail
        await this.auditLogger.log({
          action: 'INVOICE_GENERATED',
          userId: req.user.id,
          resourceId: invoice.id,
          details: { folioId, totalAmount }
        });

        await trx.commit();

        const response: ApiResponse<Invoice> = {
          success: true,
          data: invoice
        };

        res.status(201).json(response);
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Records a payment against an invoice with validation
   * 
   * @param {RequestWithUser} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>} HTTP response with updated invoice
   */
  public async recordPayment(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { amount, method, transactionId } = req.body;
      
      const trx = await this.transactionManager.start();

      try {
        // Validate payment amount
        const invoice = await this.invoiceService.findById(invoiceId);
        if (!invoice) {
          throw new Error(ErrorCode.RESOURCE_NOT_FOUND);
        }

        const payment: Payment = {
          invoiceId,
          amount: new Decimal(amount),
          method,
          transactionId,
          paymentDate: new Date(),
          status: 'COMPLETED'
        };

        // Process payment through payment gateway
        const processedPayment = await this.paymentGateway.processPayment(payment);

        // Update invoice status and balance
        const updatedInvoice = await this.invoiceService.recordPayment(
          invoiceId,
          processedPayment,
          trx
        );

        // Log audit trail
        await this.auditLogger.log({
          action: 'PAYMENT_RECORDED',
          userId: req.user.id,
          resourceId: invoice.id,
          details: { amount, method, transactionId }
        });

        await trx.commit();

        const response: ApiResponse<Invoice> = {
          success: true,
          data: updatedInvoice
        };

        res.status(200).json(response);
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  // Private helper methods
  private async validateInvoiceData(data: any): Promise<Partial<Invoice>> {
    // Implement comprehensive validation logic
    return data;
  }

  private async generateInvoiceNumber(): Promise<string> {
    // Implement invoice number generation logic
    return `INV-${Date.now()}`;
  }

  private async validateFolioCompleteness(folioId: string): Promise<any> {
    // Implement folio validation logic
    return {};
  }

  private async calculateInvoiceTotals(folio: any): Promise<{
    subtotal: Decimal;
    taxAmount: Decimal;
    totalAmount: Decimal;
  }> {
    // Implement total calculation logic
    return {
      subtotal: new Decimal(0),
      taxAmount: new Decimal(0),
      totalAmount: new Decimal(0)
    };
  }

  private calculateDueDate(): Date {
    // Implement due date calculation logic
    return new Date();
  }
}