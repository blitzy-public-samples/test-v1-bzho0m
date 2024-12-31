/**
 * @fileoverview Controller responsible for managing real-time notifications across the hotel management system.
 * Implements priority-based message handling, offline message queueing, and comprehensive error handling.
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // v10.0.0
import WebSocket from 'ws'; // v8.13.0
import Redis from 'ioredis'; // v5.3.0
import { Logger } from 'winston'; // v3.11.0
import CircuitBreaker from 'opossum'; // v7.1.0
import { RateLimiter } from 'limiter'; // v2.0.0

import { RoomStatusHandler } from '../handlers/room-status.handler';
import { ServiceRequestHandler } from '../handlers/service-request.handler';
import { WebSocketEvents, WebSocketNamespaces, MessagePriority, isValidWebSocketMessage } from '../config/websocket';
import { ErrorCode, createErrorDetails } from '../../../shared/constants/error-codes';

/**
 * Enhanced interface for notification messages with tracking and priority
 */
export interface NotificationMessage {
  id: string;
  correlationId: string;
  type: NotificationType;
  targetUser?: string;
  targetGroup?: string;
  payload: unknown;
  priority: NotificationPriority;
  timestamp: Date;
  deliveryStatus: DeliveryStatus;
  retryCount?: number;
  expiresAt?: Date;
}

/**
 * Enumeration of notification types
 */
export enum NotificationType {
  ROOM_STATUS = 'ROOM_STATUS',
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  GUEST_MESSAGE = 'GUEST_MESSAGE',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  MAINTENANCE_ALERT = 'MAINTENANCE_ALERT',
  BILLING_UPDATE = 'BILLING_UPDATE',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

/**
 * Enumeration of notification priority levels
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

/**
 * Enumeration of message delivery statuses
 */
enum DeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  QUEUED = 'QUEUED'
}

/**
 * Enhanced controller for managing system-wide real-time notifications
 */
@Injectable()
export class NotificationController {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: RateLimiter;
  private readonly messageQueue: Map<string, NotificationMessage>;
  private readonly deliveryTracking: Map<string, Set<string>>;
  private readonly REDIS_NOTIFICATION_KEY = 'notifications:';
  private readonly NOTIFICATION_TTL = 86400; // 24 hours

  constructor(
    private readonly wss: WebSocket.Server,
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly roomStatusHandler: RoomStatusHandler,
    private readonly serviceRequestHandler: ServiceRequestHandler
  ) {
    this.messageQueue = new Map();
    this.deliveryTracking = new Map();
    this.initializeCircuitBreaker();
    this.initializeRateLimiter();
    this.setupPeriodicTasks();
  }

  /**
   * Initialize circuit breaker for notification delivery
   */
  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker(this.deliverNotification.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      name: 'notificationDelivery'
    });

    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened for notification delivery');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker attempting to close');
    });
  }

  /**
   * Initialize rate limiter for notification sending
   */
  private initializeRateLimiter(): void {
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 1000,
      interval: 'minute'
    });
  }

  /**
   * Send notification with priority handling and delivery tracking
   */
  public async sendNotification(message: NotificationMessage): Promise<void> {
    try {
      // Validate message format
      if (!this.validateNotificationMessage(message)) {
        throw new Error(ErrorCode.VALIDATION_ERROR);
      }

      // Check rate limit
      const rateLimitResult = await this.rateLimiter.tryRemoveTokens(1);
      if (!rateLimitResult) {
        throw new Error(ErrorCode.RATE_LIMIT_EXCEEDED);
      }

      // Set message metadata
      message.timestamp = new Date();
      message.deliveryStatus = DeliveryStatus.PENDING;
      message.retryCount = 0;
      message.expiresAt = new Date(Date.now() + this.NOTIFICATION_TTL * 1000);

      // Store in Redis
      await this.storeNotification(message);

      // Attempt delivery through circuit breaker
      await this.circuitBreaker.fire(message);

      this.logger.info('Notification sent successfully', {
        messageId: message.id,
        type: message.type,
        priority: message.priority
      });
    } catch (error) {
      this.logger.error('Failed to send notification', {
        error,
        messageId: message.id,
        type: message.type
      });
      await this.handleDeliveryFailure(message, error);
    }
  }

  /**
   * Deliver notification to target recipients
   */
  private async deliverNotification(message: NotificationMessage): Promise<void> {
    const wsMessage = {
      event: this.mapNotificationTypeToEvent(message.type),
      namespace: this.determineNamespace(message.type),
      payload: message.payload,
      timestamp: message.timestamp,
      messageId: message.id,
      correlationId: message.correlationId,
      sender: 'NOTIFICATION_CONTROLLER',
      priority: this.mapPriorityToWSPriority(message.priority)
    };

    const recipients = await this.determineRecipients(message);
    const deliveryPromises = recipients.map(async (client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(wsMessage));
          await this.trackDelivery(message.id, client);
          return true;
        }
        return false;
      } catch (error) {
        this.logger.error('Delivery failed to client', { error, messageId: message.id });
        return false;
      }
    });

    const results = await Promise.allSettled(deliveryPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

    if (successCount === 0) {
      throw new Error('No successful deliveries');
    }

    message.deliveryStatus = DeliveryStatus.DELIVERED;
    await this.updateNotificationStatus(message);
  }

  /**
   * Handle notification delivery failure
   */
  private async handleDeliveryFailure(message: NotificationMessage, error: Error): Promise<void> {
    message.retryCount = (message.retryCount || 0) + 1;
    message.deliveryStatus = DeliveryStatus.FAILED;

    if (message.retryCount < 3 && this.shouldRetry(message.priority)) {
      this.messageQueue.set(message.id, message);
      message.deliveryStatus = DeliveryStatus.QUEUED;
    }

    await this.updateNotificationStatus(message);

    if (this.isHighPriority(message.priority)) {
      await this.notifyAdministrators(message, error);
    }
  }

  /**
   * Store notification in Redis
   */
  private async storeNotification(message: NotificationMessage): Promise<void> {
    await this.redisClient.setex(
      `${this.REDIS_NOTIFICATION_KEY}${message.id}`,
      this.NOTIFICATION_TTL,
      JSON.stringify(message)
    );
  }

  /**
   * Update notification status in Redis
   */
  private async updateNotificationStatus(message: NotificationMessage): Promise<void> {
    await this.redisClient.setex(
      `${this.REDIS_NOTIFICATION_KEY}${message.id}`,
      this.NOTIFICATION_TTL,
      JSON.stringify(message)
    );
  }

  /**
   * Set up periodic maintenance tasks
   */
  private setupPeriodicTasks(): void {
    // Process queued messages
    setInterval(() => this.processMessageQueue(), 60000);

    // Clean up expired messages
    setInterval(() => this.cleanupExpiredMessages(), 3600000);

    // Health check
    setInterval(() => this.checkHealth(), 30000);
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    for (const [id, message] of this.messageQueue.entries()) {
      try {
        await this.circuitBreaker.fire(message);
        this.messageQueue.delete(id);
      } catch (error) {
        this.logger.error('Failed to process queued message', { error, messageId: id });
      }
    }
  }

  /**
   * Validate notification message format
   */
  private validateNotificationMessage(message: NotificationMessage): boolean {
    return (
      message &&
      typeof message.id === 'string' &&
      typeof message.correlationId === 'string' &&
      Object.values(NotificationType).includes(message.type) &&
      Object.values(NotificationPriority).includes(message.priority) &&
      (message.targetUser || message.targetGroup) &&
      message.payload !== undefined
    );
  }

  /**
   * Map notification type to WebSocket event
   */
  private mapNotificationTypeToEvent(type: NotificationType): WebSocketEvents {
    const mapping = {
      [NotificationType.ROOM_STATUS]: WebSocketEvents.ROOM_STATUS_UPDATE,
      [NotificationType.SERVICE_REQUEST]: WebSocketEvents.SERVICE_REQUEST,
      [NotificationType.GUEST_MESSAGE]: WebSocketEvents.GUEST_MESSAGE,
      [NotificationType.SYSTEM_ALERT]: WebSocketEvents.SYSTEM_ALERT,
      [NotificationType.MAINTENANCE_ALERT]: WebSocketEvents.MAINTENANCE_NOTIFICATION,
      [NotificationType.BILLING_UPDATE]: WebSocketEvents.BILLING_UPDATE
    };
    return mapping[type] || WebSocketEvents.SYSTEM_ALERT;
  }

  /**
   * Map notification priority to WebSocket priority
   */
  private mapPriorityToWSPriority(priority: NotificationPriority): MessagePriority {
    const mapping = {
      [NotificationPriority.LOW]: MessagePriority.LOW,
      [NotificationPriority.MEDIUM]: MessagePriority.MEDIUM,
      [NotificationPriority.HIGH]: MessagePriority.HIGH,
      [NotificationPriority.URGENT]: MessagePriority.HIGH,
      [NotificationPriority.CRITICAL]: MessagePriority.HIGH
    };
    return mapping[priority];
  }

  /**
   * Check system health
   */
  private async checkHealth(): Promise<void> {
    const metrics = {
      queueSize: this.messageQueue.size,
      circuitBreakerState: this.circuitBreaker.status,
      activeConnections: this.wss.clients.size,
      redisConnected: this.redisClient.status === 'ready'
    };

    this.logger.info('Notification system health check', { metrics });
  }
}