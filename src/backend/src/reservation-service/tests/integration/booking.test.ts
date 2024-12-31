/**
 * @fileoverview Integration tests for booking management functionality
 * Validates end-to-end flows including real-time inventory updates,
 * dynamic pricing, and operational efficiency metrics
 * @version 1.0.0
 */

// External imports
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import * as supertest from 'supertest';
import { describe, it, beforeEach, afterEach, expect, jest } from 'jest';

// Internal imports
import { BookingController } from '../../src/controllers/booking.controller';
import { PricingService } from '../../src/services/pricing.service';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { BookingStatus, PaymentStatus } from '../../src/models/booking.model';
import { RoomStatus } from '../../../room-service/src/models/room.model';

describe('BookingController Integration Tests', () => {
  let app: any;
  let moduleRef: TestingModule;
  let bookingController: BookingController;
  let pricingService: PricingService;
  let testRoomId: string;
  let testGuestId: string;

  beforeEach(async () => {
    // Create testing module with mocked dependencies
    moduleRef = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        PricingService,
        {
          provide: 'CacheManager',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: 'AuditLogger',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    bookingController = moduleRef.get<BookingController>(BookingController);
    pricingService = moduleRef.get<PricingService>(PricingService);

    // Set up test data
    await setupTestData();
  });

  afterEach(async () => {
    // Clean up test data and close connections
    await cleanupTestData();
    await app.close();
  });

  describe('Booking Creation with Dynamic Pricing', () => {
    it('should create a booking with correct dynamic pricing', async () => {
      // Prepare test data
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);

      const bookingData = {
        guestId: testGuestId,
        roomId: testRoomId,
        checkInDate,
        checkOutDate,
        numberOfGuests: 2,
        bookingSource: 'DIRECT',
        lastModifiedBy: 'test-user',
      };

      // Execute booking creation
      const response = await supertest(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(bookingData)
        .expect(201);

      // Verify response structure
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('bookingNumber');
      expect(response.body).toHaveProperty('status', BookingStatus.PENDING);
      expect(response.body).toHaveProperty('paymentStatus', PaymentStatus.UNPAID);
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body.auditTrail).toHaveLength(1);

      // Verify dynamic pricing calculation
      const calculatedRate = await pricingService.calculateRate(
        testRoomId,
        checkInDate,
        checkOutDate,
        0.75, // Test occupancy
        'DIRECT'
      );
      expect(response.body.totalAmount).toBe(calculatedRate);

      // Verify inventory update
      const roomStatus = await getRoomStatus(testRoomId);
      expect(roomStatus).toBe(RoomStatus.RESERVED);
    });

    it('should handle concurrent booking requests correctly', async () => {
      // Prepare concurrent booking requests
      const bookingRequests = Array(5).fill(null).map(() => ({
        guestId: faker.string.uuid(),
        roomId: testRoomId,
        checkInDate: new Date(Date.now() + 86400000),
        checkOutDate: new Date(Date.now() + 259200000),
        numberOfGuests: 2,
        bookingSource: 'DIRECT',
        lastModifiedBy: 'test-user',
      }));

      // Execute concurrent requests
      const results = await Promise.allSettled(
        bookingRequests.map(data =>
          supertest(app.getHttpServer())
            .post('/api/v1/bookings')
            .send(data)
        )
      );

      // Verify only one booking succeeded
      const successfulBookings = results.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      );
      expect(successfulBookings).toHaveLength(1);

      // Verify others received conflict error
      const failedBookings = results.filter(
        result => result.status === 'fulfilled' && result.value.status === 409
      );
      expect(failedBookings).toHaveLength(4);
    });
  });

  describe('Booking Lifecycle Management', () => {
    let testBookingId: string;

    beforeEach(async () => {
      // Create a test booking
      const booking = await createTestBooking();
      testBookingId = booking.id;
    });

    it('should process check-in with inventory update', async () => {
      const response = await supertest(app.getHttpServer())
        .put(`/api/v1/bookings/${testBookingId}/check-in`)
        .send({ userId: 'test-user' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CHECKED_IN);
      
      // Verify room status update
      const roomStatus = await getRoomStatus(testRoomId);
      expect(roomStatus).toBe(RoomStatus.OCCUPIED);
    });

    it('should process check-out with inventory release', async () => {
      // First check in
      await supertest(app.getHttpServer())
        .put(`/api/v1/bookings/${testBookingId}/check-in`)
        .send({ userId: 'test-user' });

      // Then check out
      const response = await supertest(app.getHttpServer())
        .put(`/api/v1/bookings/${testBookingId}/check-out`)
        .send({ userId: 'test-user' })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CHECKED_OUT);
      
      // Verify room status update
      const roomStatus = await getRoomStatus(testRoomId);
      expect(roomStatus).toBe(RoomStatus.CLEANING);
    });

    it('should handle booking cancellation with inventory release', async () => {
      const response = await supertest(app.getHttpServer())
        .put(`/api/v1/bookings/${testBookingId}/cancel`)
        .send({
          reason: 'Guest request',
          userId: 'test-user'
        })
        .expect(200);

      expect(response.body.status).toBe(BookingStatus.CANCELLED);
      expect(response.body.cancellationReason).toBe('Guest request');
      
      // Verify room status update
      const roomStatus = await getRoomStatus(testRoomId);
      expect(roomStatus).toBe(RoomStatus.AVAILABLE);
    });
  });

  describe('Performance and Efficiency Metrics', () => {
    it('should complete booking creation within SLA', async () => {
      const startTime = Date.now();
      
      await supertest(app.getHttpServer())
        .post('/api/v1/bookings')
        .send({
          guestId: testGuestId,
          roomId: testRoomId,
          checkInDate: new Date(Date.now() + 86400000),
          checkOutDate: new Date(Date.now() + 259200000),
          numberOfGuests: 2,
          bookingSource: 'DIRECT',
          lastModifiedBy: 'test-user',
        })
        .expect(201);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 1 second SLA
    });

    it('should handle high concurrency without degradation', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(null).map(() =>
        supertest(app.getHttpServer())
          .get('/api/v1/bookings')
          .query({ status: BookingStatus.CONFIRMED })
      );

      await Promise.all(requests);

      const avgResponseTime = (Date.now() - startTime) / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(100); // 100ms average response time
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test room
    testRoomId = faker.string.uuid();
    testGuestId = faker.string.uuid();
    // Additional setup as needed
  }

  async function cleanupTestData() {
    // Clean up test data
    await moduleRef.get('DatabaseConnection').cleanup();
  }

  async function createTestBooking() {
    return bookingController.create({
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: new Date(Date.now() + 86400000),
      checkOutDate: new Date(Date.now() + 259200000),
      numberOfGuests: 2,
      bookingSource: 'DIRECT',
      lastModifiedBy: 'test-user',
    });
  }

  async function getRoomStatus(roomId: string): Promise<RoomStatus> {
    const room = await moduleRef.get('RoomModel').findById(roomId);
    return room.status;
  }
});