/**
 * @fileoverview Express router configuration for invoice-related endpoints in the billing service.
 * Implements secure routes for invoice management with comprehensive validation and error handling.
 * @version 1.0.0
 */

// External imports
import { Router } from 'express'; // v4.18.0
import { body, param, query, validationResult } from 'express-validator'; // v7.0.0

// Internal imports
import { InvoiceController } from '../controllers/invoice.controller';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { RequestWithUser } from '../../../shared/interfaces/base-controller.interface';

// Initialize router
const router = Router();
const invoiceController = new InvoiceController();

/**
 * Validation middleware for invoice creation
 */
const validateCreateInvoice = [
  body('folioId').isUUID().withMessage('Valid folio ID is required'),
  body('guestId').isUUID().withMessage('Valid guest ID is required'),
  body('reservationId').isUUID().withMessage('Valid reservation ID is required'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Valid currency code required'),
  body('items').isArray().withMessage('Invoice items are required'),
  body('items.*.description').isString().notEmpty().withMessage('Item description required'),
  body('items.*.quantity').isNumeric().withMessage('Valid quantity required'),
  body('items.*.unitPrice').isNumeric().withMessage('Valid unit price required'),
  body('items.*.taxRate').isNumeric().withMessage('Valid tax rate required')
];

/**
 * Validation middleware for invoice payment
 */
const validatePayment = [
  param('id').isUUID().withMessage('Valid invoice ID required'),
  body('amount').isNumeric().withMessage('Valid payment amount required'),
  body('method').isIn(['CASH', 'CARD', 'BANK_TRANSFER']).withMessage('Valid payment method required'),
  body('transactionId').isString().notEmpty().withMessage('Transaction ID required')
];

/**
 * Validation middleware for invoice queries
 */
const validateListQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Valid page number required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Valid limit required'),
  query('status').optional().isIn(Object.values(['DRAFT', 'ISSUED', 'PAID', 'VOID'])),
  query('dateFrom').optional().isISO8601().withMessage('Valid from date required'),
  query('dateTo').optional().isISO8601().withMessage('Valid to date required'),
  query('minAmount').optional().isNumeric().withMessage('Valid minimum amount required'),
  query('maxAmount').optional().isNumeric().withMessage('Valid maximum amount required')
];

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req: RequestWithUser, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid request parameters',
        details: errors.array()
      }
    });
  }
  next();
};

/**
 * @route GET /api/v1/invoices
 * @desc Get all invoices with filtering and pagination
 * @access Private
 */
router.get(
  '/',
  validateListQuery,
  handleValidationErrors,
  invoiceController.findAll
);

/**
 * @route GET /api/v1/invoices/:id
 * @desc Get invoice by ID
 * @access Private
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Valid invoice ID required')],
  handleValidationErrors,
  invoiceController.findById
);

/**
 * @route POST /api/v1/invoices
 * @desc Create new invoice
 * @access Private
 */
router.post(
  '/',
  validateCreateInvoice,
  handleValidationErrors,
  invoiceController.create
);

/**
 * @route POST /api/v1/invoices/generate
 * @desc Generate invoice from folio
 * @access Private
 */
router.post(
  '/generate',
  [body('folioId').isUUID().withMessage('Valid folio ID required')],
  handleValidationErrors,
  invoiceController.generateInvoice
);

/**
 * @route PUT /api/v1/invoices/:id/void
 * @desc Void an existing invoice
 * @access Private
 */
router.put(
  '/:id/void',
  [
    param('id').isUUID().withMessage('Valid invoice ID required'),
    body('reason').isString().notEmpty().withMessage('Void reason required')
  ],
  handleValidationErrors,
  invoiceController.voidInvoice
);

/**
 * @route POST /api/v1/invoices/:id/payment
 * @desc Record payment for an invoice
 * @access Private
 */
router.post(
  '/:id/payment',
  validatePayment,
  handleValidationErrors,
  invoiceController.recordPayment
);

export default router;