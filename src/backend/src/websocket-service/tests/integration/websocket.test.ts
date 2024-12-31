/**
 * @fileoverview Integration tests for WebSocket service functionality including real-time updates,
 * connection handling, error scenarios, and performance testing.
 * @version 1.0.0
 */

// External imports
import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } from '@jest/globals'; // v29.0.0
import WebSocket from 'ws'; // v8.13.0
import supertest from 'supertest'; // v6.3.3

// Internal imports
import { 
  WebSocketEvents, 
  WebSocketNamespaces 
} from '../../src/config/websocket';
import { RoomStatusHandler } from '../../src/handlers/room-status.handler';
import { ServiceRequestHandler, ServiceRequestType, ServiceRequestStatus } from '../../src/handlers/service-request.handler';
import { RoomStatus } from '../../../room-service/src/models/room.model';
import { ErrorCode } from '../../../shared/constants/error-codes';

// Test configuration constants
const TEST_WS_PORT = 3002;
const TEST_WS_PATH = '/ws-test';
const CONNECTION_POOL_SIZE = 50;
const TEST_TIMEOUT = 5000;

describe('WebSocket Service Integration Tests', () => {
  let wsServer: WebSocket.Server;
  let wsClients: WebSocket[] = [];
  let roomStatusHandler: RoomStatusHandler;
  let serviceRequestHandler: ServiceRequestHandler;
  let httpServer: any;

  beforeAll(async () => {
    // Initialize HTTP server for WebSocket upgrade
    httpServer = await initializeTestServer();
    
    // Initialize WebSocket server with test configuration
    wsServer = new WebSocket.Server({
      port: TEST_WS_PORT,
      path: TEST_WS_PATH,
      clientTracking: true,
      maxPayload: 1048576 // 1MB
    });

    // Initialize handlers
    roomStatusHandler = new RoomStatusHandler(
      global.logger,
      global.roomStatusService,
      wsServer
    );

    serviceRequestHandler = new ServiceRequestHandler(
      wsServer,
      global.redisClient,
      global.logger
    );

    // Wait for server to be ready
    await new Promise<void>((resolve) => wsServer.once('listening', () => resolve()));
  });

  afterAll(async () => {
    // Clean up all client connections
    await Promise.all(wsClients.map(client => 
      new Promise<void>((resolve) => {
        client.close();
        client.once('close', () => resolve());
      })
    ));

    // Close server and cleanup
    await new Promise<void>((resolve) => wsServer.close(() => resolve()));
    await httpServer.close();
  });

  beforeEach(async () => {
    // Reset test data before each test
    await global.redisClient.flushall();
  });

  describe('Connection Management', () => {
    test('should handle multiple client connections correctly', async () => {
      const clients = await createTestClients(5);
      expect(wsServer.clients.size).toBe(5);
      
      // Verify all clients are connected
      clients.forEach(client => {
        expect(client.readyState).toBe(WebSocket.OPEN);
      });
    });

    test('should handle connection limits', async () => {
      const maxConnections = 100;
      const clients = await createTestClients(maxConnections + 1);
      
      // Verify connection limit enforcement
      expect(wsServer.clients.size).toBeLessThanOrEqual(maxConnections);
      
      // Cleanup excess connections
      await cleanupTestClients(clients);
    });

    test('should handle authentication during connection upgrade', async () => {
      const response = await supertest(httpServer)
        .get(TEST_WS_PATH)
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Room Status Updates', () => {
    test('should broadcast room status updates to all connected clients', async () => {
      const clients = await createTestClients(3);
      const messagePromises = clients.map(client => 
        waitForMessage(client, WebSocketEvents.ROOM_STATUS_UPDATE)
      );

      // Send room status update
      const statusUpdate = {
        roomNumber: '101',
        currentStatus: RoomStatus.AVAILABLE,
        newStatus: RoomStatus.OCCUPIED,
        timestamp: new Date(),
        userId: 'test-user'
      };

      await roomStatusHandler.handleRoomStatusUpdate(wsServer.clients.values().next().value, statusUpdate);

      // Verify all clients received the update
      const receivedMessages = await Promise.all(messagePromises);
      receivedMessages.forEach(message => {
        expect(message.event).toBe(WebSocketEvents.ROOM_STATUS_UPDATE);
        expect(message.payload.roomNumber).toBe(statusUpdate.roomNumber);
        expect(message.payload.newStatus).toBe(statusUpdate.newStatus);
      });
    });

    test('should handle invalid room status transitions', async () => {
      const client = await createTestClient();
      const errorPromise = waitForMessage(client, 'error');

      // Attempt invalid status transition
      const invalidUpdate = {
        roomNumber: '101',
        currentStatus: RoomStatus.AVAILABLE,
        newStatus: RoomStatus.CLEANING,
        timestamp: new Date(),
        userId: 'test-user'
      };

      await roomStatusHandler.handleRoomStatusUpdate(client, invalidUpdate);

      const errorMessage = await errorPromise;
      expect(errorMessage.code).toBe(ErrorCode.INVALID_OPERATION);
    });
  });

  describe('Service Requests', () => {
    test('should handle service request creation and assignment', async () => {
      const staffClient = await createTestClient('staff-1');
      const messagePromise = waitForMessage(staffClient, WebSocketEvents.SERVICE_REQUEST);

      const serviceRequest = {
        requestId: 'req-1',
        guestId: 'guest-1',
        roomNumber: '101',
        requestType: ServiceRequestType.HOUSEKEEPING_REGULAR,
        description: 'Room cleaning required',
        priority: 5,
        status: ServiceRequestStatus.PENDING
      };

      await serviceRequestHandler.handleServiceRequest(serviceRequest);

      const receivedMessage = await messagePromise;
      expect(receivedMessage.event).toBe(WebSocketEvents.SERVICE_REQUEST);
      expect(receivedMessage.payload.requestId).toBe(serviceRequest.requestId);
      expect(receivedMessage.payload.status).toBe(ServiceRequestStatus.PENDING);
    });

    test('should handle service request timeout and escalation', async () => {
      jest.useFakeTimers();
      const managementClient = await createTestClient('manager-1');
      const escalationPromise = waitForMessage(managementClient, WebSocketEvents.SERVICE_REQUEST);

      const serviceRequest = {
        requestId: 'req-timeout-1',
        guestId: 'guest-1',
        roomNumber: '102',
        requestType: ServiceRequestType.MAINTENANCE_ROUTINE,
        description: 'Light bulb replacement',
        priority: 3,
        status: ServiceRequestStatus.PENDING
      };

      await serviceRequestHandler.handleServiceRequest(serviceRequest);
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(300000); // 5 minutes

      const escalatedMessage = await escalationPromise;
      expect(escalatedMessage.payload.status).toBe(ServiceRequestStatus.ESCALATED);
      
      jest.useRealTimers();
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high message throughput', async () => {
      const clients = await createTestClients(CONNECTION_POOL_SIZE);
      const startTime = Date.now();
      const messageCount = 1000;
      
      // Send multiple messages rapidly
      const sendPromises = Array.from({ length: messageCount }, (_, i) => {
        const statusUpdate = {
          roomNumber: `${100 + (i % 50)}`,
          currentStatus: RoomStatus.AVAILABLE,
          newStatus: RoomStatus.OCCUPIED,
          timestamp: new Date(),
          userId: 'test-user'
        };
        return roomStatusHandler.handleRoomStatusUpdate(wsServer.clients.values().next().value, statusUpdate);
      });

      await Promise.all(sendPromises);
      const duration = Date.now() - startTime;
      
      // Verify performance metrics
      expect(duration).toBeLessThan(TEST_TIMEOUT);
      expect(wsServer.clients.size).toBe(CONNECTION_POOL_SIZE);
    });
  });

  // Helper functions
  async function createTestClient(clientId?: string): Promise<WebSocket> {
    const client = new WebSocket(`ws://localhost:${TEST_WS_PORT}${TEST_WS_PATH}`);
    if (clientId) {
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'identify', clientId }));
      });
    }
    await new Promise<void>((resolve) => client.once('open', () => resolve()));
    wsClients.push(client);
    return client;
  }

  async function createTestClients(count: number): Promise<WebSocket[]> {
    return Promise.all(Array.from({ length: count }, (_, i) => 
      createTestClient(`client-${i}`)
    ));
  }

  async function cleanupTestClients(clients: WebSocket[]): Promise<void> {
    await Promise.all(clients.map(client => 
      new Promise<void>((resolve) => {
        client.close();
        client.once('close', () => resolve());
      })
    ));
  }

  function waitForMessage(client: WebSocket, eventType: string): Promise<any> {
    return new Promise((resolve) => {
      client.once('message', (data: WebSocket.Data) => {
        const message = JSON.parse(data.toString());
        if (message.event === eventType) {
          resolve(message);
        }
      });
    });
  }

  async function initializeTestServer() {
    const express = require('express');
    const app = express();
    return app.listen(TEST_WS_PORT);
  }
});