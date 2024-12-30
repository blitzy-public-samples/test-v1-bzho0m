#!/usr/bin/env bash

# Hotel Management ERP Production Deployment Script
# Version: 1.0.0
# Dependencies:
# - kubectl v1.25+ (Kubernetes cluster management)
# - aws-cli v2.0+ (AWS resource management)
# - jq v1.6+ (JSON processing)

set -euo pipefail
IFS=$'\n\t'

# Global variables
readonly CLUSTER_NAME="hotel-erp-production"
readonly NAMESPACE="production"
readonly AWS_REGION="us-west-2"
readonly DEPLOYMENT_TIMEOUT="900"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly KUBERNETES_DIR="${SCRIPT_DIR}/../kubernetes"
readonly LOG_FILE="/var/log/hotel-erp/deployment-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "[$(date +'%Y-%m-%dT%H:%M:%S%z')] ${GREEN}INFO${NC}: $*" | tee -a "${LOG_FILE}"
}

log_warn() {
    echo -e "[$(date +'%Y-%m-%dT%H:%M:%S%z')] ${YELLOW}WARN${NC}: $*" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "[$(date +'%Y-%m-%dT%H:%M:%S%z')] ${RED}ERROR${NC}: $*" | tee -a "${LOG_FILE}"
}

# Verify deployment prerequisites
verify_prerequisites() {
    local version_tag=$1
    log_info "Verifying deployment prerequisites..."

    # Check required tools
    for tool in kubectl aws jq; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool $tool is not installed"
            return 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Invalid AWS credentials"
        return 1
    }

    # Check EKS cluster access
    if ! kubectl get nodes &> /dev/null; then
        log_error "Cannot access EKS cluster ${CLUSTER_NAME}"
        return 1
    }

    # Verify container images exist in ECR
    local services=("api-gateway" "web-frontend" "billing-service" "guest-service" "reservation-service")
    for service in "${services[@]}"; do
        if ! aws ecr describe-images --repository-name "hotel-erp/${service}" --image-ids imageTag="${version_tag}" &> /dev/null; then
            log_error "Image hotel-erp/${service}:${version_tag} not found in ECR"
            return 1
        fi
    done

    # Validate Kubernetes manifests
    for manifest in "${KUBERNETES_DIR}"/apps/*.yaml; do
        if ! kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
            log_error "Invalid Kubernetes manifest: $manifest"
            return 1
        fi
    done

    log_info "Prerequisites verification completed successfully"
    return 0
}

# Create backup of critical data
create_backup() {
    local backup_prefix=$1
    local backup_id
    backup_id=$(date +%Y%m%d-%H%M%S)
    log_info "Creating backup with ID: ${backup_id}"

    # Create RDS snapshot
    aws rds create-db-snapshot \
        --db-instance-identifier hotel-erp-production \
        --db-snapshot-identifier "${backup_prefix}-${backup_id}" \
        --tags Key=Environment,Value=production Key=BackupType,Value=deployment

    # Backup Redis cache
    kubectl exec -n "${NAMESPACE}" deploy/redis -- redis-cli save

    # Archive configuration
    kubectl get configmap -n "${NAMESPACE}" -o yaml > "${SCRIPT_DIR}/backups/configmap-${backup_id}.yaml"
    kubectl get secret -n "${NAMESPACE}" -o yaml > "${SCRIPT_DIR}/backups/secrets-${backup_id}.yaml"

    log_info "Backup completed successfully with ID: ${backup_id}"
    echo "${backup_id}"
}

# Deploy services in correct order
deploy_services() {
    local version_tag=$1
    local namespace=$2
    log_info "Starting deployment of services with version ${version_tag}"

    # Deploy API Gateway first
    log_info "Deploying API Gateway..."
    kubectl apply -f "${KUBERNETES_DIR}/apps/api-gateway.yaml"
    kubectl rollout status deployment/api-gateway -n "${namespace}" --timeout="${DEPLOYMENT_TIMEOUT}s"

    # Deploy core services
    local core_services=("billing-service" "guest-service" "reservation-service" "room-service")
    for service in "${core_services[@]}"; do
        log_info "Deploying ${service}..."
        kubectl set image deployment/"${service}" \
            "${service}=hotel-erp/${service}:${version_tag}" \
            -n "${namespace}"
        kubectl rollout status deployment/"${service}" -n "${namespace}" --timeout="${DEPLOYMENT_TIMEOUT}s"
    done

    # Deploy web frontend last
    log_info "Deploying Web Frontend..."
    kubectl apply -f "${KUBERNETES_DIR}/apps/web-frontend.yaml"
    kubectl rollout status deployment/web-frontend -n "${namespace}" --timeout="${DEPLOYMENT_TIMEOUT}s"

    log_info "All services deployed successfully"
    return 0
}

# Verify deployment health
verify_deployment() {
    local namespace=$1
    log_info "Verifying deployment health..."

    # Check pod status
    local unhealthy_pods
    unhealthy_pods=$(kubectl get pods -n "${namespace}" \
        -o jsonpath='{.items[?(@.status.phase!="Running")].metadata.name}')
    if [[ -n "${unhealthy_pods}" ]]; then
        log_error "Unhealthy pods detected: ${unhealthy_pods}"
        return 1
    fi

    # Verify service endpoints
    local services=("api-gateway" "web-frontend" "billing-service" "guest-service" "reservation-service")
    for service in "${services[@]}"; do
        if ! kubectl get endpoints "${service}" -n "${namespace}" | grep -q "[0-9]"; then
            log_error "No endpoints found for service: ${service}"
            return 1
        fi
    done

    # Check critical API endpoints
    local api_gateway_url
    api_gateway_url=$(kubectl get svc api-gateway -n "${namespace}" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    if ! curl -sf "${api_gateway_url}/health" &> /dev/null; then
        log_error "API Gateway health check failed"
        return 1
    fi

    log_info "Deployment health verification completed successfully"
    return 0
}

# Rollback deployment
rollback_deployment() {
    local previous_version=$1
    local backup_id=$2
    log_error "Initiating rollback to version ${previous_version}"

    # Stop current deployment
    kubectl rollout stop deployment -n "${NAMESPACE}" -l app=hotel-erp

    # Restore previous version
    local services=("api-gateway" "web-frontend" "billing-service" "guest-service" "reservation-service")
    for service in "${services[@]}"; do
        log_info "Rolling back ${service} to version ${previous_version}"
        kubectl rollout undo deployment/"${service}" -n "${NAMESPACE}"
        kubectl rollout status deployment/"${service}" -n "${NAMESPACE}" --timeout="${DEPLOYMENT_TIMEOUT}s"
    done

    # Restore configuration if needed
    if [[ -f "${SCRIPT_DIR}/backups/configmap-${backup_id}.yaml" ]]; then
        kubectl apply -f "${SCRIPT_DIR}/backups/configmap-${backup_id}.yaml"
    fi

    log_info "Rollback completed successfully"
    return 0
}

# Main deployment function
main() {
    if [[ $# -lt 1 ]]; then
        log_error "Usage: $0 <version_tag>"
        exit 1
    fi

    local version_tag=$1
    local previous_version
    local backup_id

    # Create deployment log directory
    mkdir -p "$(dirname "${LOG_FILE}")"

    log_info "Starting production deployment for version ${version_tag}"

    # Get current version for potential rollback
    previous_version=$(kubectl get deployment api-gateway -n "${NAMESPACE}" \
        -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)

    # Verify prerequisites
    if ! verify_prerequisites "${version_tag}"; then
        log_error "Prerequisites verification failed"
        exit 1
    fi

    # Create backup
    backup_id=$(create_backup "pre-deploy")
    if [[ $? -ne 0 ]]; then
        log_error "Backup creation failed"
        exit 1
    fi

    # Deploy services
    if ! deploy_services "${version_tag}" "${NAMESPACE}"; then
        log_error "Deployment failed"
        rollback_deployment "${previous_version}" "${backup_id}"
        exit 1
    fi

    # Verify deployment
    if ! verify_deployment "${NAMESPACE}"; then
        log_error "Deployment verification failed"
        rollback_deployment "${previous_version}" "${backup_id}"
        exit 1
    fi

    log_info "Deployment completed successfully"
    return 0
}

# Execute main function
main "$@"
```

This deployment script follows enterprise-grade practices and includes:

1. Comprehensive prerequisite verification
2. Automated backup creation before deployment
3. Ordered service deployment with health checks
4. Extensive deployment verification
5. Automated rollback capabilities
6. Detailed logging and error handling
7. Security validations
8. Resource health monitoring

Key features:

- Uses proper error handling with `set -euo pipefail`
- Implements colored logging for better visibility
- Verifies all required tools and permissions
- Creates backups of critical data before deployment
- Deploys services in the correct order with health checks
- Validates deployment success with multiple checks
- Provides automatic rollback on failure
- Follows the technical specification's deployment requirements
- Maintains detailed logs of the deployment process

The script can be executed with:
```bash
./deploy-production.sh v1.0.0