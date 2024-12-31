import { useState, useEffect, useCallback, useRef } from 'react'; // react@18.0.0
import { WebSocketEvents, WebSocketNamespaces } from '@/websocket-service/config';

// Connection states for detailed status tracking
export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

// Interface for WebSocket statistics tracking
interface WebSocketStatistics {
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
  lastHeartbeat: Date | null;
  averageLatency: number;
  uptime: number;
}

// Configuration options for the WebSocket hook
interface UseWebSocketOptions {
  url: string;
  namespace: WebSocketNamespaces;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  debug?: boolean;
}

// Type-safe message structure
interface WebSocketMessage<T = unknown> {
  event: WebSocketEvents;
  namespace: WebSocketNamespaces;
  payload: T;
  id: string;
  timestamp: Date;
  retry?: number;
}

// Message queue item structure
interface QueuedMessage {
  message: WebSocketMessage;
  resolve: (success: boolean) => void;
  reject: (error: Error) => void;
  attempts: number;
}

const DEFAULT_OPTIONS = {
  reconnectAttempts: 5,
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
  messageQueueSize: 100,
  debug: process.env.NODE_ENV === 'development'
};

export function useWebSocket(options: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const subscriptionsRef = useRef<Map<WebSocketEvents, Set<(payload: unknown) => void>>>(
    new Map()
  );
  
  const [connectionState, setConnectionState] = useState<WebSocketState>(WebSocketState.DISCONNECTED);
  const [statistics, setStatistics] = useState<WebSocketStatistics>({
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
    lastHeartbeat: null,
    averageLatency: 0,
    uptime: 0
  });

  const config = { ...DEFAULT_OPTIONS, ...options };
  const startTimeRef = useRef<number>(Date.now());

  // Debug logging utility
  const debug = useCallback((message: string, ...args: any[]) => {
    if (config.debug) {
      console.debug(`[WebSocket][${options.namespace}] ${message}`, ...args);
    }
  }, [config.debug, options.namespace]);

  // Connection establishment
  const connect = useCallback(() => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      setConnectionState(WebSocketState.CONNECTING);
      wsRef.current = new WebSocket(`${options.url}/${options.namespace}`);

      wsRef.current.onopen = () => {
        setConnectionState(WebSocketState.CONNECTED);
        startTimeRef.current = Date.now();
        debug('Connected successfully');
        processMessageQueue();
      };

      wsRef.current.onclose = () => {
        setConnectionState(WebSocketState.DISCONNECTED);
        debug('Connection closed');
        handleReconnection();
      };

      wsRef.current.onerror = (error) => {
        setConnectionState(WebSocketState.ERROR);
        debug('Connection error:', error);
      };

      wsRef.current.onmessage = (event) => {
        handleIncomingMessage(event);
      };
    } catch (error) {
      debug('Connection establishment failed:', error);
      setConnectionState(WebSocketState.ERROR);
    }
  }, [options.url, options.namespace]);

  // Message handling
  const handleIncomingMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      if (!message.event || !message.namespace) {
        throw new Error('Invalid message format');
      }

      setStatistics(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1,
        lastHeartbeat: new Date()
      }));

      const subscribers = subscriptionsRef.current.get(message.event);
      subscribers?.forEach(callback => callback(message.payload));
      
      debug('Received message:', message);
    } catch (error) {
      debug('Error processing incoming message:', error);
    }
  }, []);

  // Message sending with queuing
  const sendMessage = useCallback(async (
    event: WebSocketEvents,
    payload: unknown
  ): Promise<boolean> => {
    const message: WebSocketMessage = {
      event,
      namespace: options.namespace,
      payload,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(message));
          setStatistics(prev => ({
            ...prev,
            messagesSent: prev.messagesSent + 1
          }));
          resolve(true);
        } catch (error) {
          reject(error);
        }
      } else {
        if (messageQueueRef.current.length >= config.messageQueueSize!) {
          reject(new Error('Message queue full'));
          return;
        }

        messageQueueRef.current.push({
          message,
          resolve,
          reject,
          attempts: 0
        });
        debug('Message queued:', message);
      }
    });
  }, [options.namespace]);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    while (messageQueueRef.current.length > 0) {
      const queuedMessage = messageQueueRef.current[0];
      
      try {
        wsRef.current.send(JSON.stringify(queuedMessage.message));
        setStatistics(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1
        }));
        queuedMessage.resolve(true);
        messageQueueRef.current.shift();
      } catch (error) {
        queuedMessage.attempts++;
        if (queuedMessage.attempts >= config.reconnectAttempts!) {
          queuedMessage.reject(new Error('Max retry attempts reached'));
          messageQueueRef.current.shift();
        }
        break;
      }
    }
  }, []);

  // Subscription management
  const subscribe = useCallback((
    event: WebSocketEvents,
    callback: (payload: unknown) => void
  ) => {
    if (!subscriptionsRef.current.has(event)) {
      subscriptionsRef.current.set(event, new Set());
    }
    subscriptionsRef.current.get(event)!.add(callback);
    debug('Subscribed to event:', event);

    return () => {
      subscriptionsRef.current.get(event)?.delete(callback);
      if (subscriptionsRef.current.get(event)?.size === 0) {
        subscriptionsRef.current.delete(event);
      }
      debug('Unsubscribed from event:', event);
    };
  }, []);

  // Reconnection logic
  const handleReconnection = useCallback(() => {
    if (connectionState === WebSocketState.RECONNECTING) {
      return;
    }

    const attemptReconnect = (attempt: number) => {
      if (attempt >= config.reconnectAttempts!) {
        setConnectionState(WebSocketState.ERROR);
        debug('Max reconnection attempts reached');
        return;
      }

      setConnectionState(WebSocketState.RECONNECTING);
      setStatistics(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));

      setTimeout(() => {
        debug(`Reconnection attempt ${attempt + 1}/${config.reconnectAttempts}`);
        connect();
      }, config.reconnectInterval! * Math.pow(2, attempt));
    };

    attemptReconnect(0);
  }, [connectionState, connect, config.reconnectAttempts, config.reconnectInterval]);

  // Heartbeat mechanism
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage(WebSocketEvents.SYSTEM_ALERT, { type: 'heartbeat' })
          .catch(error => debug('Heartbeat failed:', error));
      }
    }, config.heartbeatInterval);

    return () => clearInterval(heartbeatInterval);
  }, [config.heartbeatInterval, sendMessage]);

  // Statistics update
  useEffect(() => {
    const statsInterval = setInterval(() => {
      setStatistics(prev => ({
        ...prev,
        uptime: (Date.now() - startTimeRef.current) / 1000
      }));
    }, 1000);

    return () => clearInterval(statsInterval);
  }, []);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      messageQueueRef.current = [];
      subscriptionsRef.current.clear();
    };
  }, [connect]);

  return {
    isConnected: connectionState === WebSocketState.CONNECTED,
    connectionState,
    sendMessage,
    subscribe,
    unsubscribe: (event: WebSocketEvents) => subscriptionsRef.current.delete(event),
    reconnect: connect,
    statistics
  };
}
```

This implementation provides a comprehensive WebSocket hook with the following features:

1. Type-safe event handling using WebSocketEvents and WebSocketNamespaces
2. Robust connection lifecycle management
3. Automatic reconnection with exponential backoff
4. Message queuing during disconnections
5. Subscription-based event handling
6. Comprehensive error handling and debugging
7. Connection statistics tracking
8. Heartbeat mechanism for connection health monitoring
9. Memory leak prevention through proper cleanup
10. Support for multiple namespaces
11. Performance optimization through useCallback and useRef

The hook can be used in components like this:

```typescript
const { isConnected, sendMessage, subscribe } = useWebSocket({
  url: 'wss://api.hotel.com/ws',
  namespace: WebSocketNamespaces.ROOM_MANAGEMENT,
  reconnectAttempts: 5,
  debug: true
});

// Subscribe to room status updates
useEffect(() => {
  const unsubscribe = subscribe(WebSocketEvents.ROOM_STATUS_UPDATE, (payload) => {
    console.log('Room status updated:', payload);
  });
  
  return unsubscribe;
}, []);

// Send a service request
const handleServiceRequest = async () => {
  try {
    await sendMessage(WebSocketEvents.SERVICE_REQUEST, {
      roomNumber: '101',
      requestType: 'HOUSEKEEPING'
    });
  } catch (error) {
    console.error('Failed to send service request:', error);
  }
};