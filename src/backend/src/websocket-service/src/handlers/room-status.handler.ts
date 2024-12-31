/**
 * @fileoverview WebSocket handler for real-time room status updates with enhanced reliability,
 * security, monitoring, and error handling capabilities.
 * @version 1.0.0
 */

// External imports
import { Injectable } from '@nestjs/common'; // v10.0.0
import { WebSocket } from 'ws'; // v8.13.0
import { Logger } from 'winston'; // v3.11.0
import CircuitBreaker from 'opossum'; // v7.1.0

// Internal imports
import { RoomStatusService } from '../../../room-service/src/services/room-status.service';
import { WebSocketEvents, MessagePriority, WebSocketNamespaces, isValidWebSocketMessage } from '../config/websocket';
import { RoomStatus } from '../../../room-service/src/models/room.model';
import { ErrorCode, createErrorDetails } from '../../../shared/constants/error-codes';

/**
 * Interface for room status update messages
 */
interface RoomStatusMessage {
  correlationId: string;
  roomNumber: string;
  currentStatus: RoomStatus;
  newStatus: RoomStatus;
  reason: StatusTransitionReason;
  userId: string;
  timestamp: Date;
  priority: MessagePriority;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced WebSocket handler for room status updates with comprehensive monitoring
 * and error handling capabilities.
 */
@Injectable()
export class RoomStatusHandler {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly connectionPool: Map<string, WebSocket>;
  private readonly messageQueue: Array<RoomStatusMessage>;
  private readonly healthCheckInterval: NodeJS.Timeout;

  constructor(
    private readonly logger: Logger,
    private readonly roomStatusService: RoomStatusService,
    private readonly wss: WebSocket.Server
  ) {
    this.connectionPool = new Map();
    this.messageQueue = [];

    // Initialize circuit breaker for status updates
    this.circuitBreaker = new CircuitBreaker(this.processStatusUpdate.bind(this), {
      timeout: 5000, // 5 second timeout
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 second reset
      name: 'roomStatusUpdate'
    });

    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();

    // Initialize WebSocket server event handlers
    this.initializeWebSocketServer();

    // Start health monitoring
    this.healthCheckInterval = setInterval(() => this.monitorHealth(), 30000);
  }

  /**
   * Set up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened for room status updates', {
        service: 'RoomStatusHandler',
        event: 'circuitBreaker'
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker attempting to close', {
        service: 'RoomStatusHandler'
      });
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed, service recovered', {
        service: 'RoomStatusHandler'
      });
    });
  }

  /**
   * Initialize WebSocket server event handlers
   */
  private initializeWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = req.headers['x-client-id'] || crypto.randomUUID();
      this.connectionPool.set(clientId, ws);

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (isValidWebSocketMessage(message)) {
            await this.handleRoomStatusUpdate(ws, message as RoomStatusMessage);
          } else {
            ws.send(JSON.stringify(createErrorDetails(ErrorCode.VALIDATION_ERROR)));
          }
        } catch (error) {
          this.logger.error('Error processing WebSocket message', { error });
          ws.send(JSON.stringify(createErrorDetails(ErrorCode.INTERNAL_SERVER_ERROR)));
        }
      });

      ws.on('close', () => {
        this.connectionPool.delete(clientId);
        this.logger.info('Client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error, clientId });
        this.connectionPool.delete(clientId);
      });
    });
  }

  /**
   * Handle room status update messages
   */
  public async handleRoomStatusUpdate(
    client: WebSocket,
    message: RoomStatusMessage
  ): Promise<void> {
    try {
      // Validate status transition
      const isValid = await this.roomStatusService.validateStatusTransition(
        message.currentStatus,
        message.newStatus,
        {
          roomNumber: message.roomNumber,
          currentStatus: message.currentStatus,
          newStatus: message.newStatus,
          reason: message.reason,
          userId: message.userId,
          timestamp: message.timestamp,
          businessHoursCheck: true
        }
      );

      if (!isValid) {
        client.send(JSON.stringify(createErrorDetails(ErrorCode.INVALID_OPERATION)));
        return;
      }

      // Process status update through circuit breaker
      await this.circuitBreaker.fire(message);

      // Broadcast successful update to all connected clients
      this.broadcastStatusUpdate(message);

      this.logger.info('Room status updated successfully', {
        roomNumber: message.roomNumber,
        newStatus: message.newStatus,
        correlationId: message.correlationId
      });
    } catch (error) {
      this.logger.error('Failed to process room status update', {
        error,
        message,
        correlationId: message.correlationId
      });
      client.send(JSON.stringify(createErrorDetails(ErrorCode.INTERNAL_SERVER_ERROR)));
    }
  }

  /**
   * Process status update with retry mechanism
   */
  private async processStatusUpdate(message: RoomStatusMessage): Promise<void> {
    try {
      await this.roomStatusService.updateStatus({
        roomNumber: message.roomNumber,
        currentStatus: message.currentStatus,
        newStatus: message.newStatus,
        reason: message.reason,
        userId: message.userId,
        timestamp: message.timestamp,
        businessHoursCheck: true
      });
    } catch (error) {
      this.logger.error('Error in processStatusUpdate', { error, message });
      throw error; // Propagate error to circuit breaker
    }
  }

  /**
   * Broadcast status update to all connected clients
   */
  private broadcastStatusUpdate(message: RoomStatusMessage): void {
    const broadcastMessage = JSON.stringify({
      event: WebSocketEvents.ROOM_STATUS_UPDATE,
      namespace: WebSocketNamespaces.ROOM_MANAGEMENT,
      payload: message,
      timestamp: new Date(),
      messageId: crypto.randomUUID(),
      correlationId: message.correlationId,
      sender: 'SYSTEM',
      priority: message.priority
    });

    this.connectionPool.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(broadcastMessage);
      }
    });
  }

  /**
   * Monitor system health and performance
   */
  private monitorHealth(): void {
    const metrics = {
      activeConnections: this.connectionPool.size,
      queueLength: this.messageQueue.length,
      circuitBreakerState: this.circuitBreaker.status,
      timestamp: new Date().toISOString()
    };

    this.logger.info('Health metrics', { metrics });

    // Clean up stale connections
    this.connectionPool.forEach((client, id) => {
      if (client.readyState === WebSocket.CLOSED) {
        this.connectionPool.delete(id);
      }
    });
  }

  /**
   * Cleanup resources on service shutdown
   */
  public onModuleDestroy(): void {
    clearInterval(this.healthCheckInterval);
    this.connectionPool.clear();
    this.wss.close();
  }
}