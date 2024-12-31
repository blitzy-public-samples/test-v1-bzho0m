# Stage 1: Builder
FROM node:18-alpine AS builder

# Install build dependencies and pnpm
RUN apk add --no-cache python3 make g++ curl \
    && corepack enable \
    && corepack prepare pnpm@8.x --activate

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and config files
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN pnpm prisma:generate

# Build TypeScript code
RUN pnpm build

# Prune development dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache curl

# Create non-root user and group
RUN addgroup -g 1000 node_group \
    && adduser -u 1000 -G node_group -s /bin/sh -D node_user

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts and dependencies from builder
COPY --from=builder --chown=node_user:node_group /usr/src/app/dist ./dist
COPY --from=builder --chown=node_user:node_group /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node_user:node_group /usr/src/app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Set proper permissions
RUN chmod 755 /usr/src/app \
    && find /usr/src/app -type f -exec chmod 644 {} \; \
    && find /usr/src/app -type d -exec chmod 755 {} \;

# Switch to non-root user
USER node_user

# Expose application port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]