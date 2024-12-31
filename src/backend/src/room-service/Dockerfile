# Stage 1: Builder
FROM node:18-alpine AS builder

# Install build dependencies including lock system SDKs
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    openssl \
    # Lock system build dependencies
    libusb-dev \
    bluez-dev \
    && corepack enable \
    && corepack prepare pnpm@8.x --activate

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with lock system libraries
RUN pnpm install --frozen-lockfile \
    # Install lock system SDKs
    && pnpm add @salto/lock-system@^2.0.0 \
    @rfid/reader@^3.0.0 \
    @ble/scanner@^1.0.0

# Copy source code and configs
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client with lock system models
RUN pnpm prisma:generate

# Build TypeScript code
RUN pnpm build

# Generate secure key pairs for lock system
RUN mkdir -p keys && \
    openssl genrsa -out keys/lock_system_private.pem 4096 && \
    openssl rsa -in keys/lock_system_private.pem -pubout -out keys/lock_system_public.pem

# Remove development dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:18-alpine

# Install runtime dependencies for lock system
RUN apk add --no-cache \
    curl \
    libusb \
    bluez \
    openssl \
    tzdata

# Create non-root user with lock system permissions
RUN addgroup -g 1000 node_group && \
    adduser -u 1000 -G node_group -s /bin/sh -D node_user && \
    # Add user to dialout group for lock system access
    adduser node_user dialout

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts from builder
COPY --from=builder --chown=node_user:node_group /usr/src/app/dist ./dist
COPY --from=builder --chown=node_user:node_group /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node_user:node_group /usr/src/app/package.json ./
COPY --from=builder --chown=node_user:node_group /usr/src/app/prisma ./prisma

# Copy lock system certificates and keys
COPY --from=builder --chown=node_user:node_group /usr/src/app/keys ./keys

# Create directories for offline cache
RUN mkdir -p cache/lock_system && \
    chown -R node_user:node_group cache

# Set proper permissions
RUN chmod 755 /usr/src/app && \
    chmod 600 keys/* && \
    find /usr/src/app -type f -exec chmod 644 {} \; && \
    find /usr/src/app -type d -exec chmod 755 {} \;

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV SERVICE_NAME=room-service
ENV LOCK_SYSTEM_PORT=8080
ENV OFFLINE_MODE_DURATION=48h

# Expose ports for main service and lock system
EXPOSE 3000 8080

# Switch to non-root user
USER node_user

# Health check for both service and lock system
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health && \
        curl -f http://localhost:8080/lock-system/health || exit 1

# Start the application with lock system initialization
CMD ["node", "dist/index.js"]