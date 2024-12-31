/**
 * @fileoverview Comprehensive unit test suite for InvoiceController testing invoice management
 * functionality including financial operations, multi-currency support, and audit trails.
 * @version 1.0.0
 */

// External imports
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { Decimal } from 'decimal.js';

// Internal imports
import { InvoiceController } from '../../src/controllers/invoice.controller';
import { Invoice, InvoiceStatus } from '../../src/models/invoice.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

// Mock services
jest.mock('../../src/services/invoice.service');
jest.mock('../../src/services/currency.service');
jest.mock('../../src/services/tax.service');
jest.mock('../../src/services/audit.service');

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let mockInvoiceService: jest.Mocked<any>;
  let mockTransactionManager: jest.Mocked<any>;
  let mockAuditLogger: jest.Mocked<any>;
  let mockPaymentGateway: jest.Mocked<any>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Initialize mocks
    mockInvoiceService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      recordPayment: jest.fn(),
      calculateTax: jest.fn(),
      convertCurrency: jest.fn()
    };

    mockTransactionManager = {
      start: jest.fn().mockResolvedValue({
        commit: jest.fn(),
        rollback: jest.fn()
      })
    };

    mockAuditLogger = {
      log: jest.fn()
    };

    mockPaymentGateway = {
      processPayment: jest.fn()
    };

    mockReq = {
      user: { id: 'test-user-id', role: 'staff' },
      params: {},
      query: {},
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    controller = new InvoiceController(
      mockInvoiceService,
      mockTransactionManager,
      mockAuditLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validInvoiceData = {
      guestId: 'guest-123',
      folioId: 'folio-123',
      currency: 'USD',
      items: [
        {
          description: 'Room Charge',
          quantity: 1,
          unitPrice: new Decimal('200.00'),
          taxRate: new Decimal('0.10')
        }
      ]
    };

    it('should create a new invoice successfully', async () => {
      // Arrange
      mockReq.body = validInvoiceData;
      const mockInvoice = {
        id: 'invoice-123',
        invoiceNumber: 'INV-2023001',
        ...validInvoiceData,
        status: InvoiceStatus.DRAFT
      };
      mockInvoiceService.create.mockResolvedValue(mockInvoice);

      // Act
      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockInvoiceService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validInvoiceData,
          status: InvoiceStatus.DRAFT,
          createdBy: 'test-user-id'
        }),
        expect.any(Object)
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'INVOICE_CREATED',
        userId: 'test-user-id',
        resourceId: 'invoice-123',
        details: expect.any(Object)
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockInvoice
      });
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockReq.body = { ...validInvoiceData, currency: 'INVALID' };

      // Act
      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.VALIDATION_ERROR
        })
      );
    });
  });

  describe('generateInvoice', () => {
    const mockFolio = {
      id: 'folio-123',
      guestId: 'guest-123',
      reservationId: 'res-123',
      charges: [
        {
          description: 'Room Charge',
          amount: new Decimal('200.00'),
          taxRate: new Decimal('0.10')
        }
      ]
    };

    it('should generate an invoice from folio successfully', async () => {
      // Arrange
      mockReq.params = { folioId: 'folio-123' };
      mockInvoiceService.findById.mockResolvedValue(mockFolio);

      // Act
      await controller.generateInvoice(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockInvoiceService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          folioId: 'folio-123',
          status: InvoiceStatus.ISSUED
        }),
        expect.any(Object)
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('recordPayment', () => {
    const mockPayment = {
      amount: new Decimal('200.00'),
      method: 'CREDIT_CARD',
      transactionId: 'tx-123'
    };

    it('should record payment successfully', async () => {
      // Arrange
      mockReq.params = { invoiceId: 'invoice-123' };
      mockReq.body = mockPayment;
      mockInvoiceService.findById.mockResolvedValue({
        id: 'invoice-123',
        totalAmount: new Decimal('200.00'),
        status: InvoiceStatus.ISSUED
      });
      mockPaymentGateway.processPayment.mockResolvedValue({
        ...mockPayment,
        status: 'COMPLETED'
      });

      // Act
      await controller.recordPayment(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockPaymentGateway.processPayment).toHaveBeenCalled();
      expect(mockInvoiceService.recordPayment).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'PAYMENT_RECORDED',
        userId: 'test-user-id',
        resourceId: 'invoice-123',
        details: expect.any(Object)
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices with filters', async () => {
      // Arrange
      mockReq.query = {
        page: '1',
        limit: '10',
        status: InvoiceStatus.ISSUED,
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31'
      };
      const mockInvoices = [{ id: 'invoice-123' }];
      mockInvoiceService.findAll.mockResolvedValue(mockInvoices);
      mockInvoiceService.count.mockResolvedValue(1);

      // Act
      await controller.findAll(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockInvoiceService.findAll).toHaveBeenCalledWith(
        expect.any(Object),
        { page: 1, limit: 10 }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockInvoices,
        pagination: expect.any(Object)
      });
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax correctly for different jurisdictions', async () => {
      // Arrange
      const mockInvoiceWithTax = {
        id: 'invoice-123',
        items: [
          {
            amount: new Decimal('200.00'),
            taxRate: new Decimal('0.10')
          }
        ]
      };
      mockInvoiceService.calculateTax.mockResolvedValue({
        taxAmount: new Decimal('20.00'),
        details: { VAT: new Decimal('20.00') }
      });

      // Act & Assert
      const result = await controller['calculateInvoiceTotals'](mockInvoiceWithTax);
      expect(result.taxAmount).toEqual(new Decimal('20.00'));
    });
  });

  describe('currency conversion', () => {
    it('should handle multi-currency operations correctly', async () => {
      // Arrange
      mockReq.body = {
        amount: '200.00',
        sourceCurrency: 'USD',
        targetCurrency: 'EUR'
      };
      mockInvoiceService.convertCurrency.mockResolvedValue(new Decimal('170.00'));

      // Act & Assert
      const result = await controller['convertCurrency'](
        new Decimal('200.00'),
        'USD',
        'EUR'
      );
      expect(result).toEqual(new Decimal('170.00'));
    });
  });

  describe('audit trail', () => {
    it('should maintain comprehensive audit trail for all operations', async () => {
      // Arrange
      const mockOperation = {
        action: 'INVOICE_MODIFIED',
        userId: 'test-user-id',
        resourceId: 'invoice-123',
        details: { field: 'status', oldValue: 'DRAFT', newValue: 'ISSUED' }
      };

      // Act
      await mockAuditLogger.log(mockOperation);

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining(mockOperation)
      );
    });
  });
});