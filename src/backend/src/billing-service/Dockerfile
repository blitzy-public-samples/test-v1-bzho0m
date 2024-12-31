# Stage 1: Builder
# node:18-alpine v18.17.1
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build essentials and pnpm
RUN apk add --no-cache python3 make g++ \
    && corepack enable \
    && corepack prepare pnpm@8.6.12 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN pnpm build

# Run security audit
RUN pnpm audit

# Remove dev dependencies
RUN pnpm prune --prod

# Stage 2: Production
# node:18-alpine v18.17.1
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install security updates and production dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache tini

# Copy built artifacts from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Set proper permissions
RUN chown -R appuser:appgroup /usr/src/app

# Configure security policies
RUN apk add --no-cache dumb-init && \
    chmod -R 550 /usr/src/app && \
    chmod -R 770 /usr/src/app/dist/logs

# Expose port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Set resource limits
LABEL com.docker.resource.cpu="2" \
      com.docker.resource.memory="4GB"

# Security labels
LABEL org.opencontainers.image.vendor="Hotel Management ERP" \
      org.opencontainers.image.title="Billing Service" \
      org.opencontainers.image.description="Secure payment processing microservice" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="Private" \
      com.docker.security.non-root="true" \
      com.docker.security.scanned="true"