# Reservation Service

## Overview

The Reservation Service is a critical microservice component of the Hotel Management ERP system, responsible for managing room bookings, real-time availability tracking, and dynamic rate management. This service implements core business logic for achieving the system's operational efficiency targets and revenue optimization goals.

Version: 1.0.0  
Node.js Version: 18 LTS  
Last Updated: 2024

## Key Features

- Real-time inventory management with 99.9% uptime
- Dynamic pricing engine with yield management
- Multi-channel distribution system
- Automated booking workflow optimization
- Performance monitoring and metrics collection
- Comprehensive rate management and optimization
- Real-time availability tracking with caching

## Technical Architecture

### Core Dependencies

```typescript
express: ^4.18.0 // Web framework
@prisma/client: ^5.0.0 // Database ORM
redis: ^4.6.0 // Caching layer
dayjs: ^1.11.0 // Date manipulation
rxjs: ^7.8.0 // Reactive programming
```

### Service Components

```mermaid
graph TD
    A[API Layer] --> B[Service Layer]
    B --> C[Data Access Layer]
    B --> D[Cache Layer]
    
    subgraph Services
    E[Availability Service]
    F[Rate Service]
    G[Booking Service]
    end
    
    B --> E
    B --> F
    B --> G
    
    C --> H[(PostgreSQL)]
    D --> I[(Redis)]
```

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd src/backend/src/reservation-service
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
```

Required environment variables:
```
DATABASE_URL=postgresql://user:password@localhost:5432/hotel_erp
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
```

4. Run database migrations
```bash
npx prisma migrate dev
```

5. Start the service
```bash
npm run start
```

## API Documentation

### Endpoints

#### Availability Management

```typescript
GET /api/v1/availability
POST /api/v1/availability/check
GET /api/v1/availability/metrics
```

#### Booking Management

```typescript
POST /api/v1/bookings
GET /api/v1/bookings/:id
PUT /api/v1/bookings/:id
DELETE /api/v1/bookings/:id
```

#### Rate Management

```typescript
GET /api/v1/rates
POST /api/v1/rates/calculate
GET /api/v1/rates/optimization
```

### Authentication

All endpoints require JWT authentication with appropriate role-based access control:
- `Authorization: Bearer <token>`
- Required roles: `STAFF`, `ADMIN`, or `SYSTEM`

### Rate Limiting

```typescript
{
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}
```

## Performance Optimization

### Caching Strategy

Redis is used for caching with the following configuration:
```typescript
{
  availability: {
    ttl: 900, // 15 minutes
    pattern: 'availability:{date}:{roomType}'
  },
  rates: {
    ttl: 300, // 5 minutes
    pattern: 'rate:{rateId}:{date}:{channel}'
  }
}
```

### Database Optimization

- Connection pooling with Prisma
- Indexed queries for availability checks
- Materialized views for reporting
- Partitioned tables for historical data

## Monitoring

### Metrics Collection

```typescript
- Booking success rate
- Average response time
- Cache hit ratio
- Revenue per available room (RevPAR)
- Occupancy rate
```

### Prometheus Metrics

```typescript
- reservation_service_requests_total
- reservation_service_errors_total
- reservation_service_latency_seconds
- reservation_cache_hits_total
- reservation_booking_success_rate
```

### Health Checks

Endpoint: `/health`
```json
{
  "status": "UP",
  "checks": {
    "database": "UP",
    "cache": "UP",
    "dependencies": "UP"
  },
  "version": "1.0.0"
}
```

## Error Handling

### Standard Error Response

```typescript
{
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  traceId: string;
  path: string;
}
```

### Error Codes

```typescript
VALIDATION_ERROR: 400
RESOURCE_NOT_FOUND: 404
RESOURCE_CONFLICT: 409
INTERNAL_SERVER_ERROR: 500
```

## Integration Points

### Internal Services

- Room Service: Room inventory management
- Guest Service: Guest profile management
- Billing Service: Payment processing
- Notification Service: Booking confirmations

### External Systems

- Payment Gateway
- Channel Manager
- OTA Integration
- PMS Systems

## Contributing

1. Follow the coding style guide
2. Write unit tests for new features
3. Update documentation
4. Submit pull request

## License

Proprietary - All rights reserved