# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN apk add --no-cache python3 make g++ \
    && npm install -g pnpm@8 \
    && pnpm install --frozen-lockfile

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production
ENV WS_PORT=3001
ENV LOG_LEVEL=info

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and production dependencies only
RUN npm install -g pnpm@8 \
    && pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Configure security
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

# Switch to non-root user
USER appuser

# Expose WebSocket port
EXPOSE 3001

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${WS_PORT}/health || exit 1

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Create volume mount points
VOLUME ["/app/logs"]

# Security configurations
ENV NODE_TLS_REJECT_UNAUTHORIZED=1
ENV NODE_OPTIONS="--max-old-space-size=2048 --no-deprecation"

# Add read-only filesystem support
RUN mkdir -p /tmp/app-tmp && chown -R appuser:appgroup /tmp/app-tmp
ENV TMPDIR=/tmp/app-tmp

# Start the application
CMD ["node", "dist/index.js"]