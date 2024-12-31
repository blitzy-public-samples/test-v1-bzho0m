/**
 * @fileoverview Integration tests for payment processing functionality with PCI DSS compliance
 * @version 1.0.0
 */

// External imports - versions specified as per requirements
import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.0
import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { INestApplication } from '@nestjs/common';

// Internal imports
import { PaymentController } from '../../src/controllers/payment.controller';
import { PaymentGatewayService } from '../../src/services/payment-gateway.service';
import { PaymentMethod, PaymentStatus } from '../../src/models/payment.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

/**
 * Mock secure test data for PCI compliance
 */
const MOCK_PAYMENT_DATA = {
  amount: 150.00,
  currency: 'USD',
  paymentMethod: PaymentMethod.CREDIT_CARD,
  folioId: '123e4567-e89b-12d3-a456-426614174000',
  cardToken: 'tok_visa_testtoken',
  deviceFingerprint: 'test-device-fingerprint',
  ipAddress: '127.0.0.1'
};

/**
 * Mock gateway responses for consistent testing
 */
const MOCK_GATEWAY_RESPONSE = {
  success: true,
  transactionId: 'test_tx_123',
  gatewayReference: 'gw_ref_123',
  authorizationCode: 'auth_123',
  status: PaymentStatus.AUTHORIZED,
  riskScore: 15
};

describe('Payment Processing Integration Tests', () => {
  let app: INestApplication;
  let paymentGatewayService: jest.Mocked<PaymentGatewayService>;
  let httpServer: any;

  beforeAll(async () => {
    // Create mock payment gateway service
    const mockPaymentGatewayService = {
      authorize: jest.fn(),
      capture: jest.fn(),
      refund: jest.fn(),
      tokenize: jest.fn(),
      verifyEncryption: jest.fn(),
      validatePCICompliance: jest.fn()
    };

    // Create testing module with security configurations
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentGatewayService,
          useValue: mockPaymentGatewayService
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    httpServer = app.getHttpServer();
    paymentGatewayService = moduleRef.get(PaymentGatewayService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Security Requirements', () => {
    it('should enforce PCI compliance for card data', async () => {
      // Mock PCI compliance validation
      paymentGatewayService.validatePCICompliance.mockResolvedValue(true);

      const response = await supertest(httpServer)
        .post('/payments/validate-pci')
        .send({
          cardToken: MOCK_PAYMENT_DATA.cardToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(paymentGatewayService.validatePCICompliance).toHaveBeenCalled();
    });

    it('should properly encrypt sensitive information', async () => {
      paymentGatewayService.verifyEncryption.mockResolvedValue(true);

      const response = await supertest(httpServer)
        .post('/payments/verify-encryption')
        .send({
          cardToken: MOCK_PAYMENT_DATA.cardToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(paymentGatewayService.verifyEncryption).toHaveBeenCalled();
    });

    it('should validate security headers', async () => {
      const response = await supertest(httpServer)
        .post('/payments')
        .send(MOCK_PAYMENT_DATA)
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Payment Processing Operations', () => {
    it('should process secure payment with valid token', async () => {
      paymentGatewayService.authorize.mockResolvedValue(MOCK_GATEWAY_RESPONSE);

      const response = await supertest(httpServer)
        .post('/payments')
        .send(MOCK_PAYMENT_DATA)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
      expect(paymentGatewayService.authorize).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: MOCK_PAYMENT_DATA.amount,
          cardToken: MOCK_PAYMENT_DATA.cardToken
        })
      );
    });

    it('should handle declined transactions securely', async () => {
      paymentGatewayService.authorize.mockResolvedValue({
        ...MOCK_GATEWAY_RESPONSE,
        success: false,
        status: PaymentStatus.FAILED,
        errorCode: 'card_declined'
      });

      const response = await supertest(httpServer)
        .post('/payments')
        .send(MOCK_PAYMENT_DATA)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should process refunds with proper authorization', async () => {
      paymentGatewayService.refund.mockResolvedValue({
        ...MOCK_GATEWAY_RESPONSE,
        status: PaymentStatus.REFUNDED
      });

      const response = await supertest(httpServer)
        .post('/payments/refund')
        .send({
          transactionId: MOCK_GATEWAY_RESPONSE.transactionId,
          amount: 50.00
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('Error Handling', () => {
    it('should handle gateway timeouts securely', async () => {
      paymentGatewayService.authorize.mockRejectedValue(new Error('Gateway timeout'));

      const response = await supertest(httpServer)
        .post('/payments')
        .send(MOCK_PAYMENT_DATA)
        .expect(500);

      expect(response.body.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    });

    it('should handle encryption failures', async () => {
      paymentGatewayService.verifyEncryption.mockRejectedValue(
        new Error('Encryption verification failed')
      );

      const response = await supertest(httpServer)
        .post('/payments/verify-encryption')
        .send({ cardToken: MOCK_PAYMENT_DATA.cardToken })
        .expect(500);

      expect(response.body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });

    it('should handle invalid payment data', async () => {
      const response = await supertest(httpServer)
        .post('/payments')
        .send({
          ...MOCK_PAYMENT_DATA,
          amount: -100 // Invalid amount
        })
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('Transaction Monitoring', () => {
    it('should track risk scores for transactions', async () => {
      paymentGatewayService.authorize.mockResolvedValue({
        ...MOCK_GATEWAY_RESPONSE,
        riskScore: 75 // High risk score
      });

      const response = await supertest(httpServer)
        .post('/payments')
        .send(MOCK_PAYMENT_DATA)
        .expect(201);

      expect(response.body.data.riskScore).toBeDefined();
      expect(response.body.data.riskScore).toBe(75);
    });

    it('should validate device fingerprint', async () => {
      const response = await supertest(httpServer)
        .post('/payments')
        .send({
          ...MOCK_PAYMENT_DATA,
          deviceFingerprint: undefined
        })
        .expect(400);

      expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.body.error.message).toContain('deviceFingerprint');
    });
  });
});