import WebSocket from 'ws'; // ws@8.13.0
import Redis from 'ioredis'; // ioredis@5.3.0
import { Logger } from 'winston'; // winston@3.11.0
import CircuitBreaker from 'opossum'; // opossum@7.1.0
import { RateLimiter } from 'limiter'; // limiter@2.0.0

import {
  WebSocketEvents,
  WebSocketNamespaces,
  WebSocketMessage,
  MessagePriority,
  isValidWebSocketMessage
} from '../config/websocket';

// Service Request Type Enum
export enum ServiceRequestType {
  HOUSEKEEPING_REGULAR = 'HOUSEKEEPING_REGULAR',
  HOUSEKEEPING_URGENT = 'HOUSEKEEPING_URGENT',
  MAINTENANCE_ROUTINE = 'MAINTENANCE_ROUTINE',
  MAINTENANCE_EMERGENCY = 'MAINTENANCE_EMERGENCY',
  ROOM_SERVICE_FOOD = 'ROOM_SERVICE_FOOD',
  ROOM_SERVICE_AMENITIES = 'ROOM_SERVICE_AMENITIES',
  CONCIERGE_ASSISTANCE = 'CONCIERGE_ASSISTANCE',
  LAUNDRY_SERVICE = 'LAUNDRY_SERVICE'
}

// Service Request Status Enum
export enum ServiceRequestStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  ASSIGNED = 'ASSIGNED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  DELAYED = 'DELAYED',
  ESCALATED = 'ESCALATED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

// Service Request Interface
export interface ServiceRequest {
  requestId: string;
  guestId: string;
  roomNumber: string;
  requestType: ServiceRequestType;
  description: string;
  status: ServiceRequestStatus;
  priority: number;
  assignedStaffId?: string;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
@Metrics()
export class ServiceRequestHandler {
  private readonly staffConnections: Map<string, WebSocket>;
  private readonly requestTimeouts: Map<string, NodeJS.Timeout>;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: RateLimiter;
  private readonly REDIS_REQUEST_KEY = 'service_requests:';
  private readonly REQUEST_TIMEOUT = 300000; // 5 minutes

  constructor(
    private readonly wss: WebSocket.Server,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.staffConnections = new Map();
    this.requestTimeouts = new Map();
    this.initializeCircuitBreaker();
    this.initializeRateLimiter();
    this.setupConnectionHandlers();
    this.setupHealthCheck();
  }

  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker(this.notifyStaffWithPriority, {
      timeout: 5000, // 5 seconds
      resetTimeout: 30000, // 30 seconds
      errorThresholdPercentage: 50,
      volumeThreshold: 10
    });

    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened for staff notifications');
    });
  }

  private initializeRateLimiter(): void {
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute'
    });
  }

  private setupConnectionHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const staffId = this.extractStaffId(req);
      if (staffId) {
        this.staffConnections.set(staffId, ws);
        this.setupStaffConnectionHandlers(ws, staffId);
      }
    });
  }

  private setupStaffConnectionHandlers(ws: WebSocket, staffId: string): void {
    ws.on('close', () => {
      this.staffConnections.delete(staffId);
      this.logger.info(`Staff ${staffId} disconnected`);
    });

    ws.on('error', (error: Error) => {
      this.logger.error(`WebSocket error for staff ${staffId}:`, error);
    });
  }

  public async handleServiceRequest(request: ServiceRequest): Promise<void> {
    try {
      // Rate limiting check
      const rateLimitResult = await this.rateLimiter.tryRemoveTokens(1);
      if (!rateLimitResult) {
        throw new Error('Rate limit exceeded for service requests');
      }

      // Validate request
      if (!this.validateServiceRequest(request)) {
        throw new Error('Invalid service request format');
      }

      // Set initial status
      request.status = ServiceRequestStatus.PENDING;
      request.createdAt = new Date();
      request.updatedAt = new Date();

      // Store in Redis with expiration
      await this.redisClient.setex(
        `${this.REDIS_REQUEST_KEY}${request.requestId}`,
        86400, // 24 hours
        JSON.stringify(request)
      );

      // Determine staff group based on request type
      const staffGroup = this.determineStaffGroup(request.requestType);

      // Set timeout for request
      this.setRequestTimeout(request);

      // Notify appropriate staff
      await this.circuitBreaker.fire(request, staffGroup, request.priority);

      // Publish event for monitoring
      await this.publishRequestEvent(request);

      this.logger.info('Service request processed successfully', {
        requestId: request.requestId,
        type: request.requestType,
        status: request.status
      });

    } catch (error) {
      this.logger.error('Error processing service request:', error);
      await this.handleRequestError(request, error);
      throw error;
    }
  }

  private async notifyStaffWithPriority(
    request: ServiceRequest,
    staffGroup: WebSocketNamespaces,
    priority: number
  ): Promise<void> {
    const message: WebSocketMessage<ServiceRequest> = {
      event: WebSocketEvents.SERVICE_REQUEST,
      namespace: staffGroup,
      payload: request,
      timestamp: new Date(),
      messageId: `msg_${Date.now()}`,
      correlationId: request.requestId,
      sender: 'SERVICE_REQUEST_HANDLER',
      priority: this.mapPriorityLevel(priority)
    };

    const availableStaff = Array.from(this.staffConnections.entries())
      .filter(([staffId, ws]) => this.isStaffAvailable(staffId, staffGroup));

    if (availableStaff.length === 0) {
      await this.handleNoAvailableStaff(request);
      return;
    }

    // Sort staff by workload and send notifications
    for (const [staffId, ws] of this.sortStaffByWorkload(availableStaff)) {
      try {
        ws.send(JSON.stringify(message));
        await this.waitForAcknowledgment(staffId, request.requestId);
        return;
      } catch (error) {
        this.logger.warn(`Failed to notify staff ${staffId}`, error);
      }
    }
  }

  private setRequestTimeout(request: ServiceRequest): void {
    const timeout = setTimeout(async () => {
      await this.handleRequestTimeout(request);
    }, this.REQUEST_TIMEOUT);

    this.requestTimeouts.set(request.requestId, timeout);
  }

  private async handleRequestTimeout(request: ServiceRequest): Promise<void> {
    request.status = ServiceRequestStatus.ESCALATED;
    await this.updateRequestStatus(request);
    await this.notifyManagement(request);
  }

  private async handleRequestError(request: ServiceRequest, error: Error): Promise<void> {
    request.status = ServiceRequestStatus.FAILED;
    await this.updateRequestStatus(request);
    await this.notifyManagement(request);
  }

  private determineStaffGroup(requestType: ServiceRequestType): WebSocketNamespaces {
    switch (requestType) {
      case ServiceRequestType.HOUSEKEEPING_REGULAR:
      case ServiceRequestType.HOUSEKEEPING_URGENT:
        return WebSocketNamespaces.HOUSEKEEPING;
      case ServiceRequestType.MAINTENANCE_ROUTINE:
      case ServiceRequestType.MAINTENANCE_EMERGENCY:
        return WebSocketNamespaces.MAINTENANCE;
      default:
        return WebSocketNamespaces.GUEST_SERVICES;
    }
  }

  private mapPriorityLevel(priority: number): MessagePriority {
    if (priority >= 8) return MessagePriority.HIGH;
    if (priority >= 4) return MessagePriority.MEDIUM;
    return MessagePriority.LOW;
  }

  private validateServiceRequest(request: ServiceRequest): boolean {
    return (
      request &&
      typeof request.requestId === 'string' &&
      typeof request.guestId === 'string' &&
      typeof request.roomNumber === 'string' &&
      Object.values(ServiceRequestType).includes(request.requestType) &&
      typeof request.description === 'string' &&
      typeof request.priority === 'number'
    );
  }

  private async updateRequestStatus(request: ServiceRequest): Promise<void> {
    request.updatedAt = new Date();
    await this.redisClient.setex(
      `${this.REDIS_REQUEST_KEY}${request.requestId}`,
      86400,
      JSON.stringify(request)
    );
  }

  private setupHealthCheck(): void {
    setInterval(() => {
      this.checkConnections();
      this.checkRedisConnection();
    }, 30000); // Every 30 seconds
  }
}