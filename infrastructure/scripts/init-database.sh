#!/bin/bash

# Hotel Management ERP - Database Initialization Script
# Version: 1.0.0
# PostgreSQL Version: 13+
# Required Extensions: pgaudit 1.7+, pgpool-II 4.3+

set -euo pipefail

# Environment variables with defaults
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
SSL_CERT_PATH="${SSL_CERT_PATH}"
MONITORING_CONFIG="${MONITORING_CONFIG}"

# Service-specific database names
BILLING_DB="billing_service"
GUEST_DB="guest_service"
ROOM_DB="room_service"
RESERVATION_DB="reservation_service"

# Logging configuration
LOG_DIR="/var/log/hotel-erp/database"
mkdir -p "${LOG_DIR}"
LOGFILE="${LOG_DIR}/init-database.log"

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "${LOGFILE}"
}

# Verify PostgreSQL prerequisites
verify_prerequisites() {
    log "INFO" "Verifying PostgreSQL prerequisites..."
    
    # Check PostgreSQL version
    local version=$(psql -V | grep -oE '[0-9]{2,}' | head -n1)
    if [ "${version}" -lt 13 ]; then
        log "ERROR" "PostgreSQL version must be 13 or higher"
        return 1
    fi

    # Verify required extensions
    local required_extensions=("pgcrypto" "pgaudit" "pg_stat_statements" "pg_buffercache")
    for ext in "${required_extensions[@]}"; do
        if ! psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -tAc "SELECT 1 FROM pg_available_extensions WHERE name = '${ext}'" | grep -q 1; then
            log "ERROR" "Required extension ${ext} not available"
            return 1
        fi
    fi

    # Verify SSL configuration
    if [ ! -f "${SSL_CERT_PATH}/server.crt" ] || [ ! -f "${SSL_CERT_PATH}/server.key" ]; then
        log "ERROR" "SSL certificates not found"
        return 1
    }

    log "INFO" "Prerequisites verification completed successfully"
    return 0
}

# Create databases with security configurations
create_databases() {
    log "INFO" "Creating databases with security configurations..."

    local databases=("${BILLING_DB}" "${GUEST_DB}" "${ROOM_DB}" "${RESERVATION_DB}")
    
    for db in "${databases[@]}"; do
        log "INFO" "Creating database: ${db}"
        
        # Create database with proper encoding and collation
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" <<-EOSQL
            CREATE DATABASE ${db}
                WITH 
                ENCODING = 'UTF8'
                LC_COLLATE = 'en_US.UTF-8'
                LC_CTYPE = 'en_US.UTF-8'
                TEMPLATE = template0;

            \c ${db}

            -- Enable required extensions
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
            CREATE EXTENSION IF NOT EXISTS pgaudit;
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
            CREATE EXTENSION IF NOT EXISTS pg_buffercache;

            -- Configure row level security
            ALTER DATABASE ${db} SET row_security = on;

            -- Set secure session defaults
            ALTER DATABASE ${db} SET ssl = on;
            ALTER DATABASE ${db} SET statement_timeout = '30s';
            ALTER DATABASE ${db} SET idle_in_transaction_session_timeout = '60s';
            ALTER DATABASE ${db} SET log_statement = 'mod';
            ALTER DATABASE ${db} SET log_min_duration_statement = 1000;
EOSQL

        # Configure database-specific audit logging
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${db}" <<-EOSQL
            -- Setup audit logging
            SELECT audit.audit_table('*');
            
            -- Configure connection pooling
            CREATE EXTENSION IF NOT EXISTS pgpool_adm;
            
            -- Setup health check user and function
            CREATE USER health_checker WITH PASSWORD '${POSTGRES_PASSWORD}' NOSUPERUSER;
            GRANT CONNECT ON DATABASE ${db} TO health_checker;
            
            CREATE OR REPLACE FUNCTION public.health_check()
            RETURNS boolean AS \$\$
            BEGIN
                RETURN true;
            END;
            \$\$ LANGUAGE plpgsql SECURITY DEFINER;
            
            GRANT EXECUTE ON FUNCTION public.health_check() TO health_checker;
EOSQL
    done

    log "INFO" "Database creation completed successfully"
}

# Setup database users and permissions
setup_users() {
    log "INFO" "Setting up database users and permissions..."

    local services=("billing" "guest" "room" "reservation")
    
    for service in "${services[@]}"; do
        local user="${service}_service"
        local password=$(openssl rand -base64 32)
        
        log "INFO" "Creating user for ${service} service"
        
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" <<-EOSQL
            -- Create service user with secure password policy
            CREATE USER ${user} WITH 
                PASSWORD '${password}'
                NOSUPERUSER 
                NOCREATEDB 
                NOCREATEROLE
                NOINHERIT
                CONNECTION LIMIT 50
                VALID UNTIL 'infinity';

            -- Grant necessary permissions
            GRANT CONNECT ON DATABASE ${service}_service TO ${user};
            \c ${service}_service
            
            -- Schema-level permissions
            GRANT USAGE ON SCHEMA public TO ${user};
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${user};
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${user};

            -- Set up connection pooling for service user
            INSERT INTO pgpool.pool_passwd VALUES ('${user}', '${password}');
            
            -- Configure monitoring permissions
            GRANT SELECT ON pg_stat_statements TO ${user};
            GRANT SELECT ON pg_buffercache TO ${user};
EOSQL

        # Save credentials securely
        echo "${service}_db_user=${user}" >> /etc/hotel-erp/db_credentials
        echo "${service}_db_password=${password}" >> /etc/hotel-erp/db_credentials
        chmod 600 /etc/hotel-erp/db_credentials
    done

    log "INFO" "User setup completed successfully"
}

# Configure database monitoring
configure_monitoring() {
    log "INFO" "Configuring database monitoring..."

    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" <<-EOSQL
        -- Configure performance monitoring
        ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,pg_buffercache';
        ALTER SYSTEM SET pg_stat_statements.max = 10000;
        ALTER SYSTEM SET pg_stat_statements.track = 'all';
        
        -- Setup monitoring tables
        CREATE SCHEMA IF NOT EXISTS monitoring;
        
        CREATE TABLE IF NOT EXISTS monitoring.performance_metrics (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            database_name TEXT,
            total_connections INTEGER,
            active_connections INTEGER,
            idle_connections INTEGER,
            longest_transaction_seconds INTEGER,
            cache_hit_ratio NUMERIC,
            tps NUMERIC,
            latency_ms NUMERIC
        );
        
        -- Create monitoring functions
        CREATE OR REPLACE FUNCTION monitoring.collect_metrics()
        RETURNS void AS \$\$
        BEGIN
            INSERT INTO monitoring.performance_metrics (
                database_name, 
                total_connections,
                active_connections,
                idle_connections,
                longest_transaction_seconds,
                cache_hit_ratio,
                tps,
                latency_ms
            )
            SELECT 
                current_database(),
                count(*),
                count(*) FILTER (WHERE state = 'active'),
                count(*) FILTER (WHERE state = 'idle'),
                EXTRACT(EPOCH FROM (now() - min(xact_start))) FILTER (WHERE xact_start IS NOT NULL),
                sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read),0) * 100,
                (SELECT sum(xact_commit + xact_rollback) / EXTRACT(EPOCH FROM (now() - stats_reset)) FROM pg_stat_database WHERE datname = current_database()),
                (SELECT extract(milliseconds from avg(now() - query_start)) FROM pg_stat_activity WHERE state != 'idle')
            FROM pg_stat_activity;
        END;
        \$\$ LANGUAGE plpgsql SECURITY DEFINER;
        
        -- Setup monitoring user
        CREATE USER monitoring_user WITH PASSWORD '${POSTGRES_PASSWORD}' NOSUPERUSER;
        GRANT CONNECT ON DATABASE template1 TO monitoring_user;
        GRANT USAGE ON SCHEMA monitoring TO monitoring_user;
        GRANT SELECT ON ALL TABLES IN SCHEMA monitoring TO monitoring_user;
        
        -- Create monitoring scheduler
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        SELECT cron.schedule('collect_metrics', '*/5 * * * *', 'SELECT monitoring.collect_metrics()');
EOSQL

    log "INFO" "Monitoring configuration completed successfully"
}

# Main initialization function
main() {
    log "INFO" "Starting database initialization..."

    # Verify prerequisites
    if ! verify_prerequisites; then
        log "ERROR" "Prerequisites verification failed"
        exit 1
    fi

    # Create databases
    if ! create_databases; then
        log "ERROR" "Database creation failed"
        exit 1
    fi

    # Setup users
    if ! setup_users; then
        log "ERROR" "User setup failed"
        exit 1
    fi

    # Configure monitoring
    if ! configure_monitoring; then
        log "ERROR" "Monitoring configuration failed"
        exit 1
    }

    log "INFO" "Database initialization completed successfully"
}

# Execute main function
main "$@"