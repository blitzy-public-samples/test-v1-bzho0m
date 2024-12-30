#!/usr/bin/env bash

# Hotel Management ERP System - Staging Deployment Script
# Version: 1.0.0
# Description: Automated deployment script for staging environment with enhanced monitoring and security

# Strict error handling
set -euo pipefail
trap 'error_handler $? $LINENO $BASH_LINENO "$BASH_COMMAND" $(printf "::%s" ${FUNCNAME[@]:-})' ERR

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME=$(basename "${0}")
readonly SCRIPT_VERSION="1.0.0"

# Global configuration
readonly AWS_REGION=${AWS_REGION:-"us-west-2"}
readonly CLUSTER_NAME=${CLUSTER_NAME:-"hotel-erp-staging"}
readonly NAMESPACE=${NAMESPACE:-"hotel-erp-staging"}
readonly DEPLOYMENT_TIMEOUT=${DEPLOYMENT_TIMEOUT:-1800}
readonly LOG_LEVEL=${LOG_LEVEL:-"DEBUG"}
readonly MONITORING_ENABLED=${MONITORING_ENABLED:-"true"}
readonly ROLLBACK_ENABLED=${ROLLBACK_ENABLED:-"true"}

# Logging configuration
readonly LOG_FILE="/var/log/hotel-erp/deploy-staging-$(date +%Y%m%d-%H%M%S).log"
readonly METRIC_PATH="/var/log/hotel-erp/metrics"

# Error handler function
error_handler() {
    local exit_code=$1
    local line_number=$2
    local bash_lineno=$3
    local last_command=$4
    local func_stack=$5

    log "ERROR" "An error occurred in ${SCRIPT_NAME}"
    log "ERROR" "Exit code: ${exit_code}"
    log "ERROR" "Line number: ${line_number}"
    log "ERROR" "Last command: ${last_command}"
    log "ERROR" "Function stack: ${func_stack}"

    if [[ "${ROLLBACK_ENABLED}" == "true" ]]; then
        log "INFO" "Initiating rollback procedure..."
        rollback_deployment
    fi

    exit "${exit_code}"
}

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[${timestamp}] [${level}] ${message}"
    echo "[${timestamp}] [${level}] ${message}" >> "${LOG_FILE}"

    # Push metrics if monitoring is enabled
    if [[ "${MONITORING_ENABLED}" == "true" && "${level}" != "DEBUG" ]]; then
        echo "deployment_event{level=\"${level}\",message=\"${message}\"} $(date +%s)" >> "${METRIC_PATH}"
    fi
}

# Check prerequisites function
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."

    # Check required tools
    local required_tools=("kubectl" "aws" "helm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            log "ERROR" "Required tool ${tool} is not installed"
            return 1
        fi
    done

    # Validate kubectl version
    local kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! "${kubectl_version}" =~ v1.2[4-9] ]]; then
        log "ERROR" "kubectl version ${kubectl_version} is not supported. Minimum required: v1.24"
        return 1
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "AWS credentials are not configured properly"
        return 1
    }

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Update kubeconfig function
update_kubeconfig() {
    log "INFO" "Updating kubeconfig for cluster ${CLUSTER_NAME}..."

    if ! aws eks update-kubeconfig \
        --region "${AWS_REGION}" \
        --name "${CLUSTER_NAME}" \
        --alias "${CLUSTER_NAME}"; then
        log "ERROR" "Failed to update kubeconfig"
        return 1
    fi

    # Verify cluster connectivity
    if ! kubectl cluster-info; then
        log "ERROR" "Failed to connect to cluster"
        return 1
    }

    log "INFO" "Kubeconfig updated successfully"
    return 0
}

# Deploy infrastructure function
deploy_infrastructure() {
    log "INFO" "Deploying infrastructure components..."

    # Create namespace if it doesn't exist
    if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        kubectl apply -f "${SCRIPT_DIR}/../kubernetes/base/namespace.yaml"
    fi

    # Deploy monitoring stack if enabled
    if [[ "${MONITORING_ENABLED}" == "true" ]]; then
        log "INFO" "Deploying monitoring stack..."
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --timeout 10m \
            --values "${SCRIPT_DIR}/../helm/monitoring-values.yaml"
    fi

    log "INFO" "Infrastructure deployment completed"
    return 0
}

# Deploy services function
deploy_services() {
    log "INFO" "Deploying application services..."

    # Apply frontend deployment
    kubectl apply -f "${SCRIPT_DIR}/../kubernetes/apps/web-frontend.yaml"

    # Verify deployment status
    local timeout=300
    local interval=10
    local elapsed=0

    while [[ "${elapsed}" -lt "${timeout}" ]]; do
        if kubectl rollout status deployment/web-frontend -n "${NAMESPACE}" --timeout=10s; then
            log "INFO" "Frontend deployment completed successfully"
            return 0
        fi
        sleep "${interval}"
        elapsed=$((elapsed + interval))
    done

    log "ERROR" "Frontend deployment failed to stabilize within timeout"
    return 1
}

# Verify deployment function
verify_deployment() {
    log "INFO" "Verifying deployment health..."

    # Check pod health
    local unhealthy_pods=$(kubectl get pods -n "${NAMESPACE}" \
        -o jsonpath='{.items[?(@.status.phase!="Running")].metadata.name}')
    
    if [[ -n "${unhealthy_pods}" ]]; then
        log "ERROR" "Unhealthy pods detected: ${unhealthy_pods}"
        return 1
    fi

    # Verify service endpoints
    if ! kubectl get endpoints -n "${NAMESPACE}" | grep -q "web-frontend"; then
        log "ERROR" "Frontend service endpoints not found"
        return 1
    fi

    # Check monitoring integration if enabled
    if [[ "${MONITORING_ENABLED}" == "true" ]]; then
        if ! curl -s "http://prometheus-operated.monitoring:9090/-/healthy" | grep -q "OK"; then
            log "WARNING" "Prometheus health check failed"
        fi
    fi

    log "INFO" "Deployment verification completed successfully"
    return 0
}

# Rollback deployment function
rollback_deployment() {
    log "INFO" "Initiating deployment rollback..."

    # Rollback frontend deployment
    kubectl rollout undo deployment/web-frontend -n "${NAMESPACE}"

    # Verify rollback status
    if ! kubectl rollout status deployment/web-frontend -n "${NAMESPACE}" --timeout=300s; then
        log "ERROR" "Rollback failed"
        return 1
    fi

    log "INFO" "Rollback completed successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting staging deployment for Hotel Management ERP System"
    log "INFO" "Script version: ${SCRIPT_VERSION}"

    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "${LOG_FILE}")" "$(dirname "${METRIC_PATH}")"

    # Execute deployment steps
    check_prerequisites || exit 1
    update_kubeconfig || exit 1
    deploy_infrastructure || exit 1
    deploy_services || exit 1
    verify_deployment || exit 1

    log "INFO" "Deployment completed successfully"
    return 0
}

# Execute main function
main "$@"