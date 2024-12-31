/**
 * @fileoverview Comprehensive unit tests for housekeeping controller with enhanced
 * real-time status updates, validation rules, and business logic verification.
 * @version 1.0.0
 */

// External imports - v29.0.0
import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express'; // v4.18.2

// Internal imports
import { HousekeepingController } from '../../src/controllers/housekeeping.controller';
import { RoomStatusService } from '../../src/services/room-status.service';
import { HousekeepingStatus, HousekeepingType } from '../../src/models/housekeeping.model';
import { RoomStatus } from '../../src/models/room.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

describe('HousekeepingController', () => {
  let housekeepingController: HousekeepingController;
  let mockHousekeepingService: any;
  let mockRoomStatusService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Mock services
    mockHousekeepingService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockRoomStatusService = {
      updateStatus: jest.fn(),
      validateStatusTransition: jest.fn(),
      emitStatusUpdate: jest.fn()
    };

    // Mock request/response objects
    mockRequest = {
      params: {},
      body: {},
      query: {},
      user: { id: 'staff-123', role: 'HOUSEKEEPING' }
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    mockNext = jest.fn();

    // Initialize controller with mocked services
    housekeepingController = new HousekeepingController(
      mockHousekeepingService,
      mockRoomStatusService
    );

    // Setup fake timers for time-sensitive tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('create', () => {
    test('should create housekeeping task with valid data', async () => {
      // Arrange
      const taskData = {
        roomId: 'room-123',
        type: HousekeepingType.DAILY_CLEANING,
        priority: 2,
        scheduledStartTime: new Date(),
        tasks: ['clean bathroom', 'change linens'],
        notes: 'VIP guest'
      };

      mockRequest.body = taskData;
      mockHousekeepingService.create.mockResolvedValue({
        id: 'task-123',
        ...taskData,
        status: HousekeepingStatus.PENDING
      });

      // Act
      await housekeepingController.create(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockHousekeepingService.create).toHaveBeenCalledWith({
        ...taskData,
        status: HousekeepingStatus.PENDING,
        assignedStaffId: 'staff-123'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'task-123',
          status: HousekeepingStatus.PENDING
        })
      });
    });

    test('should validate required fields', async () => {
      // Arrange
      mockRequest.body = {
        roomId: 'room-123',
        // Missing required fields
      };

      // Act
      await housekeepingController.create(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.VALIDATION_ERROR
        })
      );
    });
  });

  describe('update', () => {
    test('should validate status transitions', async () => {
      // Arrange
      const existingTask = {
        id: 'task-123',
        status: HousekeepingStatus.PENDING,
        roomId: 'room-123'
      };

      mockRequest.params = { id: 'task-123' };
      mockRequest.body = {
        status: HousekeepingStatus.IN_PROGRESS
      };

      mockHousekeepingService.findById.mockResolvedValue(existingTask);
      mockHousekeepingService.update.mockResolvedValue({
        ...existingTask,
        status: HousekeepingStatus.IN_PROGRESS,
        actualStartTime: expect.any(Date)
      });

      // Act
      await housekeepingController.update(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: HousekeepingStatus.IN_PROGRESS,
          actualStartTime: expect.any(Date)
        })
      });
    });

    test('should prevent invalid status transitions', async () => {
      // Arrange
      const existingTask = {
        id: 'task-123',
        status: HousekeepingStatus.COMPLETED,
        roomId: 'room-123'
      };

      mockRequest.params = { id: 'task-123' };
      mockRequest.body = {
        status: HousekeepingStatus.PENDING // Invalid transition
      };

      mockHousekeepingService.findById.mockResolvedValue(existingTask);

      // Act
      await housekeepingController.update(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.BUSINESS_RULE_VIOLATION
        })
      );
    });
  });

  describe('real-time updates', () => {
    test('should emit status updates within 1 minute', async () => {
      // Arrange
      const taskId = 'task-123';
      const roomId = 'room-123';
      const newStatus = HousekeepingStatus.COMPLETED;

      mockRequest.params = { id: taskId };
      mockRequest.body = { status: newStatus };

      mockHousekeepingService.findById.mockResolvedValue({
        id: taskId,
        roomId,
        status: HousekeepingStatus.IN_PROGRESS
      });

      mockHousekeepingService.update.mockResolvedValue({
        id: taskId,
        roomId,
        status: newStatus
      });

      // Act
      const updatePromise = housekeepingController.update(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Fast-forward time by 30 seconds
      jest.advanceTimersByTime(30000);
      await updatePromise;

      // Assert
      expect(mockRoomStatusService.emitStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId,
          status: RoomStatus.AVAILABLE
        })
      );
      expect(Date.now() - mockRequest.body.timestamp).toBeLessThan(60000);
    });
  });

  describe('maintenance conflicts', () => {
    test('should handle maintenance schedule conflicts', async () => {
      // Arrange
      const taskId = 'task-123';
      const roomId = 'room-123';

      mockRequest.params = { id: taskId };
      mockRequest.body = {
        status: HousekeepingStatus.IN_PROGRESS
      };

      mockHousekeepingService.findById.mockResolvedValue({
        id: taskId,
        roomId,
        status: HousekeepingStatus.PENDING
      });

      mockRoomStatusService.validateStatusTransition.mockReturnValue(false);

      // Act
      await housekeepingController.update(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.RESOURCE_CONFLICT
        })
      );
    });
  });

  describe('findAll', () => {
    test('should support comprehensive filtering', async () => {
      // Arrange
      mockRequest.query = {
        status: [HousekeepingStatus.PENDING, HousekeepingStatus.IN_PROGRESS],
        type: [HousekeepingType.DAILY_CLEANING],
        priority: JSON.stringify([1, 2]),
        dateRange: JSON.stringify({
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }),
        isInspectionRequired: 'true'
      };

      mockHousekeepingService.findAll.mockResolvedValue([]);
      mockHousekeepingService.count.mockResolvedValue(0);

      // Act
      await housekeepingController.findAll(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockHousekeepingService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: [HousekeepingStatus.PENDING, HousekeepingStatus.IN_PROGRESS],
          type: [HousekeepingType.DAILY_CLEANING],
          priority: [1, 2],
          dateRange: expect.any(Object),
          isInspectionRequired: true
        })
      );
    });
  });
});