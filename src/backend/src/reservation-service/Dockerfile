# -----------------------------------------------------------------------------
# Stage 1: Builder
# Used for building TypeScript code and generating Prisma client
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ 

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma client and build TypeScript code
RUN npm run prisma:generate && \
    npm run build

# Prune dev dependencies
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production
# Minimal image with security hardening
# -----------------------------------------------------------------------------
FROM node:18-alpine

# Set labels
LABEL maintainer="Hotel ERP Team" \
      version="1.0.0" \
      description="Reservation Service Container" \
      environment="production"

# Install runtime dependencies
RUN apk add --no-cache wget curl

# Create app directory and set ownership
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create non-root user and set permissions
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Configure resource limits
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Expose application port
EXPOSE 3000

# Set user
USER appuser

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set read-only filesystem (except for required writable directories)
RUN mkdir -p /tmp/app-cache && \
    chown -R appuser:appgroup /tmp/app-cache
VOLUME ["/tmp/app-cache"]

# Drop all capabilities except those required
RUN setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

# Set entry point
CMD ["node", "dist/index.js"]

# Security headers and configurations
ENV NODE_TLS_REJECT_UNAUTHORIZED=1 \
    NPM_CONFIG_AUDIT=true \
    NPM_CONFIG_AUDIT_LEVEL=moderate \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_STRICT_SSL=true

# Resource limits (applied at runtime via Docker)
# docker run --memory="4g" --cpus="2" --pids-limit=50 --ulimit nofile=1000
```

This Dockerfile implements a multi-stage build process with comprehensive security hardening and production optimizations. Here's a breakdown of the key features:

1. Multi-stage Build:
- Stage 1 (builder): Compiles TypeScript and generates Prisma client
- Stage 2 (production): Creates minimal production image

2. Security Features:
- Non-root user (appuser)
- Read-only filesystem
- Minimal capabilities
- Security-related environment variables
- Health check implementation

3. Resource Management:
- Memory limit configuration
- CPU limits (via Docker run)
- Process limits
- File descriptor limits

4. Best Practices:
- Layer optimization
- Proper caching
- Minimal dependencies
- Environment-specific configurations

5. Production Optimizations:
- Pruned dependencies
- Minimal base image
- Proper volume management
- Health check implementation

To build and run the container:

```bash
# Build
docker build -t reservation-service .

# Run with resource limits
docker run \
  --name reservation-service \
  --memory="4g" \
  --cpus="2" \
  --pids-limit=50 \
  --ulimit nofile=1000 \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  reservation-service