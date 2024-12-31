/**
 * @fileoverview Integration tests for room management functionality including CRUD operations,
 * status transitions, housekeeping integration, and real-time updates.
 * @version 1.0.0
 */

// External imports - Version comments included as required
import { Test, TestingModule } from '@nestjs/testing'; // v10.0.0
import { INestApplication } from '@nestjs/common'; // v10.0.0
import * as request from 'supertest'; // v6.3.0
import { io, Socket } from 'socket.io-client'; // v4.0.0
import { Logger } from 'winston'; // v3.11.0

// Internal imports
import { RoomController } from '../../src/controllers/room.controller';
import { RoomStatusService, StatusTransitionReason } from '../../src/services/room-status.service';
import { RoomModel, RoomStatus, RoomType, RoomAmenities } from '../../src/models/room.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

describe('RoomController Integration Tests', () => {
  let app: INestApplication;
  let roomController: RoomController;
  let roomStatusService: RoomStatusService;
  let wsClient: Socket;

  // Test data
  const testRoom: Partial<RoomModel> = {
    roomNumber: '101',
    type: RoomType.STANDARD,
    status: RoomStatus.AVAILABLE,
    floor: 1,
    baseRate: 100.0,
    maxOccupancy: 2,
    amenities: [RoomAmenities.WIFI, RoomAmenities.TV, RoomAmenities.SAFE],
    isAccessible: false,
    isActive: true,
    description: 'Standard Room with City View',
    images: ['room101-1.jpg', 'room101-2.jpg'],
    notes: 'Recently renovated'
  };

  // Test users with different roles
  const testUsers = {
    admin: { id: 'admin1', role: 'ADMIN', token: 'admin_jwt_token' },
    frontDesk: { id: 'staff1', role: 'FRONT_DESK', token: 'staff_jwt_token' },
    housekeeping: { id: 'house1', role: 'HOUSEKEEPING', token: 'house_jwt_token' }
  };

  beforeAll(async () => {
    // Create test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        RoomStatusService,
        {
          provide: Logger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
          }
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Initialize controller and service
    roomController = moduleFixture.get<RoomController>(RoomController);
    roomStatusService = moduleFixture.get<RoomStatusService>(RoomStatusService);

    // Initialize WebSocket client
    wsClient = io(`http://localhost:${process.env.PORT}`, {
      transports: ['websocket']
    });
  });

  afterAll(async () => {
    wsClient.disconnect();
    await app.close();
  });

  describe('POST /rooms', () => {
    it('should create a new room with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .send(testRoom)
        .expect(201);

      expect(response.body).toMatchObject({
        ...testRoom,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('should reject creation with duplicate room number', async () => {
      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .send(testRoom)
        .expect(409);
    });

    it('should validate required fields', async () => {
      const invalidRoom = { ...testRoom };
      delete invalidRoom.roomNumber;

      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .send(invalidRoom)
        .expect(400);

      expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should enforce role-based access control', async () => {
      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${testUsers.frontDesk.token}`)
        .send(testRoom)
        .expect(403);
    });
  });

  describe('PATCH /rooms/:id/status', () => {
    it('should update room status with valid transition', async () => {
      const statusUpdate = {
        status: RoomStatus.CLEANING,
        reason: StatusTransitionReason.CLEANING_REQUIRED,
        userId: testUsers.housekeeping.id
      };

      // Setup WebSocket listener for status change event
      const statusChangePromise = new Promise(resolve => {
        wsClient.on('roomStatusChange', data => resolve(data));
      });

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoom.roomNumber}/status`)
        .set('Authorization', `Bearer ${testUsers.housekeeping.token}`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.status).toBe(RoomStatus.CLEANING);

      // Verify real-time notification
      const statusChangeEvent = await statusChangePromise;
      expect(statusChangeEvent).toMatchObject({
        roomNumber: testRoom.roomNumber,
        previousStatus: RoomStatus.AVAILABLE,
        newStatus: RoomStatus.CLEANING
      });
    });

    it('should reject invalid status transitions', async () => {
      const invalidTransition = {
        status: RoomStatus.OCCUPIED,
        reason: StatusTransitionReason.CHECK_IN,
        userId: testUsers.frontDesk.id
      };

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoom.roomNumber}/status`)
        .set('Authorization', `Bearer ${testUsers.frontDesk.token}`)
        .send(invalidTransition)
        .expect(400);

      expect(response.body.code).toBe(ErrorCode.INVALID_OPERATION);
    });

    it('should validate maintenance schedule for maintenance status', async () => {
      const maintenanceUpdate = {
        status: RoomStatus.MAINTENANCE,
        reason: StatusTransitionReason.MAINTENANCE_REQUIRED,
        userId: testUsers.admin.id,
        maintenanceSchedule: {
          startTime: new Date(Date.now() + 3600000), // 1 hour from now
          endTime: new Date(Date.now() + 7200000),   // 2 hours from now
          type: 'REGULAR'
        }
      };

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoom.roomNumber}/status`)
        .set('Authorization', `Bearer ${testUsers.admin.token}`)
        .send(maintenanceUpdate)
        .expect(200);

      expect(response.body.status).toBe(RoomStatus.MAINTENANCE);
    });

    it('should handle concurrent status updates correctly', async () => {
      const update1 = {
        status: RoomStatus.CLEANING,
        reason: StatusTransitionReason.CLEANING_REQUIRED,
        userId: testUsers.housekeeping.id
      };

      const update2 = {
        status: RoomStatus.MAINTENANCE,
        reason: StatusTransitionReason.MAINTENANCE_REQUIRED,
        userId: testUsers.admin.id
      };

      // Send concurrent requests
      const [response1, response2] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/rooms/${testRoom.roomNumber}/status`)
          .set('Authorization', `Bearer ${testUsers.housekeeping.token}`)
          .send(update1),
        request(app.getHttpServer())
          .patch(`/rooms/${testRoom.roomNumber}/status`)
          .set('Authorization', `Bearer ${testUsers.admin.token}`)
          .send(update2)
      ]);

      // One should succeed and one should fail
      expect(
        (response1.status === 200 && response2.status === 409) ||
        (response1.status === 409 && response2.status === 200)
      ).toBeTruthy();
    });
  });

  describe('GET /rooms', () => {
    it('should retrieve rooms with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/rooms')
        .query({
          status: [RoomStatus.AVAILABLE, RoomStatus.CLEANING],
          type: RoomType.STANDARD,
          floor: 1
        })
        .set('Authorization', `Bearer ${testUsers.frontDesk.token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body[0]).toMatchObject({
        status: expect.stringMatching(/^(AVAILABLE|CLEANING)$/),
        type: RoomType.STANDARD,
        floor: 1
      });
    });

    it('should handle complex search criteria', async () => {
      const response = await request(app.getHttpServer())
        .get('/rooms')
        .query({
          amenities: [RoomAmenities.WIFI, RoomAmenities.TV],
          priceRange: { min: 50, max: 150 },
          isAccessible: false
        })
        .set('Authorization', `Bearer ${testUsers.frontDesk.token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      response.body.forEach((room: RoomModel) => {
        expect(room.baseRate).toBeGreaterThanOrEqual(50);
        expect(room.baseRate).toBeLessThanOrEqual(150);
        expect(room.amenities).toEqual(
          expect.arrayContaining([RoomAmenities.WIFI, RoomAmenities.TV])
        );
      });
    });
  });
});