# Room Service Microservice

## Overview

The Room Service microservice is a critical component of the Hotel Management ERP system, responsible for managing room inventory, status tracking, housekeeping coordination, and door lock integration. Built with NestJS and following enterprise-grade standards, it provides real-time room management capabilities with secure, scalable, and highly available operations.

## Features

### Core Capabilities
- Real-time room inventory management with dynamic pricing
- Multi-channel distribution support
- Comprehensive room status tracking (9 distinct states)
- Automated housekeeping schedule optimization
- Maintenance request tracking and coordination

### Door Lock Integration
- Multi-protocol support (RFID/NFC/BLE)
- AES-256 encrypted key generation
- 48-hour offline validation capability
- Real-time access control updates
- Support for multiple vendor integrations

### Technical Features
- WebSocket-based real-time status updates
- Event-driven architecture
- Redis-backed caching layer
- Circuit breaker pattern for external integrations
- Comprehensive audit logging

## Architecture

### Technology Stack
- Runtime: Node.js 18 LTS
- Framework: NestJS ^10.0.0
- Database ORM: Prisma 5.0.0
- Logging: Winston ^3.11.0
- Cache: Redis 7+
- Database: PostgreSQL 13+

### System Components
```mermaid
flowchart TD
    A[API Layer] --> B[Service Layer]
    B --> C[Data Access Layer]
    B --> D[Integration Layer]
    
    subgraph External Systems
    E[Door Lock System]
    F[Housekeeping System]
    G[Maintenance System]
    end
    
    D --> E
    D --> F
    D --> G
    
    subgraph Data Storage
    H[(PostgreSQL)]
    I[(Redis Cache)]
    end
    
    C --> H
    C --> I
```

## Installation

### Prerequisites
- Node.js 18 LTS
- PostgreSQL 13+
- Redis 7+
- Door lock system hardware
- SSL certificates

### Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd room-service

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### Required Environment Variables
```
DATABASE_URL=postgresql://user:password@localhost:5432/hotel_db
REDIS_URL=redis://localhost:6379
LOCK_SYSTEM_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_aes_256_key
WEBSOCKET_PORT=3001
```

## API Reference

### Room Management Endpoints
```typescript
GET /api/v1/rooms - List all rooms
POST /api/v1/rooms - Create new room
GET /api/v1/rooms/:id - Get room details
PUT /api/v1/rooms/:id - Update room
DELETE /api/v1/rooms/:id - Delete room

GET /api/v1/rooms/:id/status - Get room status
PUT /api/v1/rooms/:id/status - Update room status
GET /api/v1/rooms/:id/maintenance - Get maintenance history
POST /api/v1/rooms/:id/maintenance - Create maintenance request
```

### WebSocket Events
```typescript
room.status.updated - Real-time room status updates
room.maintenance.requested - New maintenance requests
room.cleaning.completed - Cleaning status updates
room.lock.status - Door lock status updates
```

## Database Schema

### Room Entity
```typescript
interface Room {
  id: UUID;
  roomNumber: string;
  type: RoomType;
  status: RoomStatus;
  floor: number;
  baseRate: Decimal;
  currentRate: Decimal;
  amenities: RoomAmenities[];
  maxOccupancy: number;
  isAccessible: boolean;
  maintenanceHistory: MaintenanceHistory;
  cleaningSchedule: CleaningSchedule;
  // ... additional fields
}
```

## Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- API key authentication for external systems

### Encryption
- AES-256 encryption for door lock keys
- TLS 1.3 for all communications
- Encrypted data at rest

## Monitoring & Logging

### Metrics
- Room availability rate
- Average cleaning time
- Maintenance response time
- System uptime
- API response times

### Logging
```typescript
// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Testing

### Test Suites
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

## Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Kubernetes Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: room-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: room-service
  template:
    metadata:
      labels:
        app: room-service
    spec:
      containers:
      - name: room-service
        image: room-service:latest
        ports:
        - containerPort: 3000
```

## Contributing

Please refer to our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the [MIT License](LICENSE).