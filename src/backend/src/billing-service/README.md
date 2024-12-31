# Hotel Management ERP Billing Service

## Overview

The Billing Service is a PCI DSS compliant microservice responsible for managing all financial transactions within the Hotel Management ERP system. It provides secure payment processing, automated night audit capabilities, and comprehensive financial reporting functionality.

Version: 1.0.0
Node.js Version: 18 LTS

## Security Compliance

### PCI DSS Level 1 Compliance

- AES-256 encryption for data at rest
- TLS 1.3 for data in transit
- AWS KMS integration for key management
- Tokenization of payment card data
- Comprehensive audit logging
- Regular security scanning

### Key Security Features

- End-to-end encryption of sensitive data
- Automated key rotation
- IP-based fraud detection
- Device fingerprinting
- Risk scoring system
- Rate limiting protection

## Architecture

### Core Components

```mermaid
flowchart TD
    A[API Layer] --> B{Security Layer}
    B --> C[Payment Processing]
    B --> D[Transaction Management]
    B --> E[Audit System]
    
    C --> F[Payment Gateways]
    D --> G[Database]
    E --> H[Audit Logs]
    
    F --> I[Stripe]
    F --> J[PayPal]
    F --> K[Other Providers]
```

### Dependencies

Internal:
- PaymentGatewayService (v1.0.0) - Secure payment processing
- BaseService Interface - Standardized service operations
- ErrorCode Constants - Error handling

External:
- @prisma/client (v5.0.0) - Database operations
- @nestjs/common (v10.0.0) - Application framework
- stripe (v12.0.0) - Payment processing

## API Documentation

### Endpoints

#### Payment Processing

```typescript
POST /api/v1/payments
Content-Type: application/json
Authorization: Bearer ${JWT_TOKEN}

{
  "amount": "100.00",
  "currency": "USD",
  "paymentMethod": "CREDIT_CARD",
  "cardToken": "encrypted_token",
  "guestId": "uuid",
  "folioId": "uuid"
}
```

#### Transaction Management

```typescript
GET /api/v1/transactions/${transactionId}
Authorization: Bearer ${JWT_TOKEN}

PUT /api/v1/transactions/${transactionId}/refund
Authorization: Bearer ${JWT_TOKEN}
Content-Type: application/json

{
  "amount": "50.00",
  "reason": "partial_refund"
}
```

### Error Handling

All errors follow standardized format:

```json
{
  "code": "ERROR_CODE",
  "message": "User-friendly error message",
  "details": {},
  "timestamp": "ISO-8601 timestamp",
  "traceId": "unique-trace-id"
}
```

## Configuration

### Environment Variables

```bash
# Required
BILLING_SERVICE_PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/db
ENCRYPTION_KEY=your-encryption-key
JWT_SECRET=your-jwt-secret

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=client-id
PAYPAL_CLIENT_SECRET=client-secret

# Optional
NODE_ENV=production
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

### Security Configuration

```typescript
const securityConfig = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationDays: 90
  },
  rateLimit: {
    maxRequests: 100,
    windowMs: 900000
  },
  audit: {
    enabled: true,
    retentionDays: 90
  }
};
```

## Deployment

### Production Requirements

- Node.js 18 LTS
- PostgreSQL 13+
- Redis 7+
- AWS KMS access
- SSL/TLS certificates

### Health Monitoring

Endpoints:
- `/health` - Basic health check
- `/health/detailed` - Detailed system status
- `/metrics` - Prometheus metrics

### Logging

Structured JSON logging with the following fields:
```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "service": "billing-service",
  "traceId": "uuid",
  "message": "log message",
  "context": {}
}
```

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Setup database
pnpm prisma migrate dev

# Run service
pnpm dev
```

### Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# Security audit
pnpm audit
```

### Code Quality

- ESLint configuration
- Prettier formatting
- Husky pre-commit hooks
- SonarQube integration

## Support

- Documentation: `/docs`
- Issue Tracking: JIRA
- Team Channel: #billing-service

## License

Proprietary - All rights reserved