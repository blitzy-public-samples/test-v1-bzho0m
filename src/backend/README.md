# Hotel Management ERP Backend Services

Enterprise-grade microservices backend for the Hotel Management ERP system, providing secure and scalable APIs for hotel operations management.

![Node.js Version][node-image] ![TypeScript Version][ts-image] ![License][license-image]

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Services](#services)
- [Security](#security)
- [Development](#development)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The Hotel Management ERP Backend Services provide a comprehensive suite of microservices for managing hotel operations, including:

- Room inventory and housekeeping management
- Guest profiles and preferences
- Reservations and bookings
- Billing and payment processing
- Real-time notifications

### Key Features

- 🔐 Enterprise-grade security with OAuth2/JWT
- 🚀 Horizontally scalable microservices
- 📊 Real-time data synchronization
- 🔄 Automated failover and recovery
- 📈 Comprehensive monitoring and logging

## Architecture

### System Components

```mermaid
flowchart TD
    A[API Gateway] --> B{Load Balancer}
    B --> C[Service Layer]
    C --> D[Cache]
    C --> E[Database]
    
    subgraph Services
    F[Billing Service]
    G[Guest Service]
    H[Room Service]
    I[Reservation Service]
    end
    
    C --> F & G & H & I
```

### Technology Stack

- **Runtime**: Node.js 18 LTS
- **Language**: TypeScript 5.0+
- **Framework**: Express.js 4.18+
- **Database**: PostgreSQL 13+
- **Cache**: Redis 7+
- **API Gateway**: Kong 3.3
- **Container**: Docker & Kubernetes
- **Message Queue**: RabbitMQ

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker >= 24.0.0
- Docker Compose >= 3.8

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hotel-management-erp.git

# Install dependencies
pnpm install

# Generate Prisma client
pnpm run prisma:generate

# Start development environment
pnpm run dev
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/hotel_erp
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

## Services

### Billing Service
Handles payment processing and financial transactions
- Port: 3000
- Endpoints: `/api/v1/billing/*`
- Dependencies: PostgreSQL, Redis, Stripe

### Guest Service
Manages guest profiles and preferences
- Port: 3001
- Endpoints: `/api/v1/guests/*`
- Dependencies: PostgreSQL, Redis

### Room Service
Controls room inventory and housekeeping
- Port: 3002
- Endpoints: `/api/v1/rooms/*`
- Dependencies: PostgreSQL, Redis, Door Lock System

### Reservation Service
Handles bookings and availability
- Port: 3003
- Endpoints: `/api/v1/reservations/*`
- Dependencies: PostgreSQL, Redis

## Security

### Authentication

- OAuth 2.0 with JWT tokens
- Role-based access control (RBAC)
- Multi-factor authentication for admin access
- Rate limiting and request throttling

### Data Protection

- End-to-end encryption for sensitive data
- PCI DSS compliance for payment processing
- GDPR compliance for guest data
- Regular security audits

## Development

### Code Style

```bash
# Run linter
pnpm run lint

# Format code
pnpm run format

# Run tests
pnpm run test
```

### API Documentation

Swagger documentation available at:
- Development: `http://localhost:8000/api-docs`
- Staging: `https://staging-api.hotel-erp.com/api-docs`

## Deployment

### Docker Deployment

```bash
# Build containers
pnpm run docker:build

# Start services
pnpm run docker:up

# Stop services
pnpm run docker:down
```

### Production Deployment

```bash
# Build production assets
pnpm run build

# Start production server
pnpm run start
```

## Monitoring

### Health Checks

- Service health: `/health`
- Database health: `/health/db`
- Cache health: `/health/cache`

### Metrics

- Prometheus metrics: `/metrics`
- Grafana dashboards available at monitoring server

## Troubleshooting

### Common Issues

1. Database Connection
```bash
# Check database status
docker-compose ps db
# Verify connection string
echo $DATABASE_URL
```

2. Redis Connection
```bash
# Check Redis status
docker-compose ps redis
# Test Redis connection
redis-cli ping
```

3. API Gateway
```bash
# Check Kong status
curl -i http://localhost:8001/status
```

## License

Private - All rights reserved

[node-image]: https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen
[ts-image]: https://img.shields.io/badge/typescript-%3E%3D5.0.0-blue
[license-image]: https://img.shields.io/badge/license-Private-red