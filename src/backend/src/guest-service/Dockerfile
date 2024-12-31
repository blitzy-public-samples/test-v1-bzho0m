# ============================================
# Stage 1: Builder
# ============================================
FROM node:18.17-alpine3.18 AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies with pnpm
RUN npm install -g pnpm@8 \
    && pnpm install --frozen-lockfile \
    && pnpm audit

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN pnpm run build

# Generate Prisma client
RUN pnpm run prisma:generate

# Run security scans
RUN pnpm run security:audit

# ============================================
# Stage 2: Production
# ============================================
FROM node:18.17-alpine3.18 AS production

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifacts and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Install production dependencies only
RUN npm install -g pnpm@8 \
    && pnpm install --prod --frozen-lockfile \
    && pnpm audit \
    && chown -R appuser:appgroup /app

# Set security configurations
RUN chmod -R 550 /app \
    && chmod -R 770 /app/node_modules \
    && chmod 770 /app/dist

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=384" \
    SECURITY_OPTS="no-new-privileges:true"

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set resource limits
ENV MEMORY_LIMIT="512Mi" \
    CPU_LIMIT="1000m" \
    PIDS_LIMIT="50" \
    MAX_FILE_DESCRIPTORS="1024"

# Switch to non-root user
USER appuser

# Expose service port
EXPOSE 3000

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Set production command
CMD ["node", "dist/index.js"]

# Set security labels
LABEL maintainer="Hotel ERP Team" \
      version="1.0.0" \
      description="Guest Service - Hotel Management ERP" \
      security.capabilities="drop=ALL" \
      security.readonly="true" \
      security.privileged="false"