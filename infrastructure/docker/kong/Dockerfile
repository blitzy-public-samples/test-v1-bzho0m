# Use official Kong image with latest security patches
# @version 3.4.0-ubuntu
FROM kong:3.4.0-ubuntu

# Set labels for container metadata and documentation
LABEL maintainer="Hotel Management ERP Team" \
      description="Kong API Gateway for Hotel Management ERP System" \
      version="1.0.0" \
      security.credentials="external" \
      monitoring.enabled="true"

# Install additional security packages and cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories with proper permissions
RUN mkdir -p /usr/local/kong/logs \
    && mkdir -p /usr/local/kong/ssl \
    && chown -R kong:kong /usr/local/kong

# Configure security settings and permissions
RUN chmod 444 /etc/kong/kong.conf.default \
    && chown -R kong:kong /usr/local/kong \
    && chmod -R 755 /usr/local/kong/logs

# Copy Kong configuration with proper permissions
COPY --chown=kong:kong config.yaml /etc/kong/config.yaml

# Set Kong environment variables for production setup
ENV KONG_DATABASE="postgres" \
    KONG_PG_HOST="${POSTGRES_HOST}" \
    KONG_PG_USER="${POSTGRES_USER}" \
    KONG_PG_PASSWORD="${POSTGRES_PASSWORD}" \
    KONG_PROXY_LISTEN="0.0.0.0:8000 reuseport backlog=16384" \
    KONG_ADMIN_LISTEN="0.0.0.0:8001" \
    KONG_PROXY_ACCESS_LOG="/dev/stdout combined" \
    KONG_ADMIN_ACCESS_LOG="/dev/stdout combined" \
    KONG_PROXY_ERROR_LOG="/dev/stderr notice" \
    KONG_ADMIN_ERROR_LOG="/dev/stderr notice" \
    KONG_PLUGINS="bundled,prometheus,correlation-id,request-transformer" \
    KONG_NGINX_WORKER_PROCESSES="auto" \
    KONG_NGINX_WORKER_CONNECTIONS="16384" \
    KONG_DECLARATIVE_CONFIG="/etc/kong/config.yaml"

# Security hardening
RUN adduser --system --no-create-home --disabled-password --disabled-login kong \
    && chown -R kong:kong /usr/local/share/lua/5.1/kong \
    && chmod -R 755 /usr/local/share/lua/5.1/kong

# Switch to non-root user for security
USER kong

# Add enhanced health check with proper intervals
HEALTHCHECK --interval=10s --timeout=10s --retries=5 --start-period=30s \
    CMD kong health

# Expose Kong ports with proper documentation
# 8000: Proxy listen port for HTTP traffic
# 8001: Admin API port for management
# 8443: Proxy SSL port for HTTPS traffic
# 8444: Admin SSL port for secure management
EXPOSE 8000 8001 8443 8444

# Set default command with proper configuration
CMD ["kong", "docker-start"]