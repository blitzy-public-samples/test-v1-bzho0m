// @ts-check
import WebSocket from 'ws';  // ws@8.13.0

/**
 * Enumeration of all WebSocket event types in the system
 * @enum {string}
 */
export enum WebSocketEvents {
    ROOM_STATUS_UPDATE = 'ROOM_STATUS_UPDATE',
    SERVICE_REQUEST = 'SERVICE_REQUEST',
    GUEST_CHECKIN = 'GUEST_CHECKIN',
    RESERVATION_CREATED = 'RESERVATION_CREATED',
    SERVICE_REQUEST_STATUS = 'SERVICE_REQUEST_STATUS',
    HOUSEKEEPING_ALERT = 'HOUSEKEEPING_ALERT',
    MAINTENANCE_NOTIFICATION = 'MAINTENANCE_NOTIFICATION',
    BILLING_UPDATE = 'BILLING_UPDATE',
    GUEST_MESSAGE = 'GUEST_MESSAGE',
    SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Enumeration of WebSocket connection namespaces for different modules
 * @enum {string}
 */
export enum WebSocketNamespaces {
    ROOM_MANAGEMENT = 'room_management',
    GUEST_SERVICES = 'guest_services',
    HOUSEKEEPING = 'housekeeping',
    MAINTENANCE = 'maintenance',
    FRONT_DESK = 'front_desk',
    BILLING = 'billing',
    ADMIN = 'admin',
    SYSTEM = 'system'
}

/**
 * Message priority levels for WebSocket communications
 * @enum {string}
 */
export enum MessagePriority {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

/**
 * Global configuration constants for WebSocket server
 */
export const WS_CONFIG = {
    DEFAULT_PORT: 3001,
    DEFAULT_PATH: '/ws',
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    MAX_PAYLOAD_SIZE: 1048576, // 1MB
    MAX_CONNECTIONS: 10000,
    PING_TIMEOUT: 5000, // 5 seconds
    RECONNECT_INTERVAL: 3000, // 3 seconds
    MESSAGE_RETENTION: 86400 // 24 hours in seconds
} as const;

/**
 * Interface defining WebSocket server configuration options
 */
export interface WebSocketConfig {
    port: number;
    path: string;
    heartbeatInterval: number;
    maxPayloadSize: number;
    maxConnections: number;
    pingTimeout: number;
    ssl: boolean;
    certPath?: string;
    keyPath?: string;
}

/**
 * Generic interface defining the structure of WebSocket messages
 * @template T - Type of the message payload
 */
export interface WebSocketMessage<T> {
    event: WebSocketEvents;
    namespace: WebSocketNamespaces;
    payload: T;
    timestamp: Date;
    messageId: string;
    correlationId: string;
    sender: string;
    priority: MessagePriority;
}

/**
 * Default WebSocket server configuration
 */
export const defaultWebSocketConfig: WebSocketConfig = {
    port: WS_CONFIG.DEFAULT_PORT,
    path: WS_CONFIG.DEFAULT_PATH,
    heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL,
    maxPayloadSize: WS_CONFIG.MAX_PAYLOAD_SIZE,
    maxConnections: WS_CONFIG.MAX_CONNECTIONS,
    pingTimeout: WS_CONFIG.PING_TIMEOUT,
    ssl: process.env.NODE_ENV === 'production'
};

/**
 * Type guard to check if a message is a valid WebSocket message
 * @param message - Message to validate
 * @returns boolean indicating if message is valid
 */
export function isValidWebSocketMessage<T>(message: any): message is WebSocketMessage<T> {
    return (
        message &&
        typeof message === 'object' &&
        'event' in message &&
        'namespace' in message &&
        'payload' in message &&
        'timestamp' in message &&
        'messageId' in message &&
        'correlationId' in message &&
        'sender' in message &&
        'priority' in message &&
        Object.values(WebSocketEvents).includes(message.event) &&
        Object.values(WebSocketNamespaces).includes(message.namespace) &&
        Object.values(MessagePriority).includes(message.priority)
    );
}

/**
 * WebSocket server options factory
 * @param config - WebSocket configuration
 * @returns WebSocket.ServerOptions
 */
export function createWebSocketServerOptions(
    config: Partial<WebSocketConfig> = {}
): WebSocket.ServerOptions {
    const finalConfig = { ...defaultWebSocketConfig, ...config };
    
    return {
        path: finalConfig.path,
        maxPayload: finalConfig.maxPayloadSize,
        clientTracking: true,
        perMessageDeflate: {
            zlibDeflateOptions: {
                level: 6 // Balanced compression
            }
        },
        ...(finalConfig.ssl && finalConfig.certPath && finalConfig.keyPath
            ? {
                  cert: finalConfig.certPath,
                  key: finalConfig.keyPath
              }
            : {})
    };
}

/**
 * Namespace configuration for different modules
 */
export const namespaceConfig = {
    [WebSocketNamespaces.ROOM_MANAGEMENT]: {
        events: [
            WebSocketEvents.ROOM_STATUS_UPDATE,
            WebSocketEvents.MAINTENANCE_NOTIFICATION
        ],
        maxClients: 1000
    },
    [WebSocketNamespaces.GUEST_SERVICES]: {
        events: [
            WebSocketEvents.GUEST_CHECKIN,
            WebSocketEvents.GUEST_MESSAGE,
            WebSocketEvents.SERVICE_REQUEST
        ],
        maxClients: 2000
    },
    [WebSocketNamespaces.HOUSEKEEPING]: {
        events: [
            WebSocketEvents.HOUSEKEEPING_ALERT,
            WebSocketEvents.ROOM_STATUS_UPDATE
        ],
        maxClients: 500
    },
    [WebSocketNamespaces.BILLING]: {
        events: [WebSocketEvents.BILLING_UPDATE],
        maxClients: 200
    },
    [WebSocketNamespaces.SYSTEM]: {
        events: [WebSocketEvents.SYSTEM_ALERT],
        maxClients: 100
    }
} as const;

export default {
    WebSocketEvents,
    WebSocketNamespaces,
    MessagePriority,
    WS_CONFIG,
    defaultWebSocketConfig,
    createWebSocketServerOptions,
    namespaceConfig,
    isValidWebSocketMessage
};