#!/bin/bash

# Hotel Management ERP Monitoring Stack Setup Script
# Version: 1.0.0
# Dependencies:
# - kubectl v1.25+ (kubernetes-cli)
# - helm v3.11+ (helm)
# Purpose: Automated setup of monitoring infrastructure including Prometheus, Grafana, Jaeger, and ELK Stack

set -euo pipefail

# Global variables
MONITORING_NAMESPACE="monitoring"
PROMETHEUS_VERSION="v2.45.0"
GRAFANA_VERSION="9.5.3"
JAEGER_VERSION="1.45"
ELK_VERSION="7.17.0"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KUBERNETES_DIR="${SCRIPT_DIR}/../kubernetes"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required but not installed. Please install kubectl v1.25+"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm is required but not installed. Please install helm v3.11+"
        exit 1
    }
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster. Please check your kubeconfig"
        exit 1
    }
    
    log_info "Prerequisites check passed"
}

# Create monitoring namespace with security policies
create_monitoring_namespace() {
    log_info "Creating monitoring namespace..."
    
    if kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        log_warn "Namespace $MONITORING_NAMESPACE already exists"
    else
        kubectl apply -f "${KUBERNETES_DIR}/base/namespace.yaml"
        log_info "Namespace $MONITORING_NAMESPACE created successfully"
    fi
    
    # Apply network policies
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/prometheus.yaml" -n "$MONITORING_NAMESPACE"
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/grafana.yaml" -n "$MONITORING_NAMESPACE"
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/jaeger.yaml" -n "$MONITORING_NAMESPACE"
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/elk-stack.yaml" -n "$MONITORING_NAMESPACE"
}

# Deploy Prometheus with high availability
deploy_prometheus() {
    log_info "Deploying Prometheus..."
    
    # Create Prometheus RBAC
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/prometheus.yaml" -n "$MONITORING_NAMESPACE"
    
    # Wait for Prometheus deployment
    kubectl rollout status statefulset/prometheus -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log_info "Prometheus deployment completed"
}

# Deploy Grafana with security dashboards
deploy_grafana() {
    log_info "Deploying Grafana..."
    
    # Create Grafana ConfigMap and deployment
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/grafana.yaml" -n "$MONITORING_NAMESPACE"
    
    # Wait for Grafana deployment
    kubectl rollout status deployment/grafana -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log_info "Grafana deployment completed"
}

# Deploy Jaeger tracing
deploy_jaeger() {
    log_info "Deploying Jaeger..."
    
    # Deploy Jaeger components
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/jaeger.yaml" -n "$MONITORING_NAMESPACE"
    
    # Wait for Jaeger deployment
    kubectl rollout status deployment/jaeger -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log_info "Jaeger deployment completed"
}

# Deploy ELK Stack with security monitoring
deploy_enhanced_elk() {
    log_info "Deploying ELK Stack..."
    
    # Deploy ELK components
    kubectl apply -f "${KUBERNETES_DIR}/monitoring/elk-stack.yaml" -n "$MONITORING_NAMESPACE"
    
    # Wait for Elasticsearch StatefulSet
    kubectl rollout status statefulset/elasticsearch -n "$MONITORING_NAMESPACE" --timeout=600s
    
    # Wait for Logstash deployment
    kubectl rollout status deployment/logstash -n "$MONITORING_NAMESPACE" --timeout=300s
    
    # Wait for Kibana deployment
    kubectl rollout status deployment/kibana -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log_info "ELK Stack deployment completed"
}

# Verify monitoring stack health
verify_monitoring_stack() {
    log_info "Verifying monitoring stack health..."
    
    local failed=0
    
    # Check Prometheus
    if ! kubectl get pods -l app=prometheus -n "$MONITORING_NAMESPACE" | grep -q "Running"; then
        log_error "Prometheus verification failed"
        failed=1
    fi
    
    # Check Grafana
    if ! kubectl get pods -l app=grafana -n "$MONITORING_NAMESPACE" | grep -q "Running"; then
        log_error "Grafana verification failed"
        failed=1
    fi
    
    # Check Jaeger
    if ! kubectl get pods -l app=jaeger -n "$MONITORING_NAMESPACE" | grep -q "Running"; then
        log_error "Jaeger verification failed"
        failed=1
    fi
    
    # Check ELK Stack
    if ! kubectl get pods -l app=elk-stack -n "$MONITORING_NAMESPACE" | grep -q "Running"; then
        log_error "ELK Stack verification failed"
        failed=1
    fi
    
    if [ $failed -eq 0 ]; then
        log_info "All monitoring components are healthy"
    else
        log_error "Some monitoring components failed verification"
        exit 1
    fi
}

# Setup monitoring stack status check
setup_monitoring_status_check() {
    log_info "Setting up monitoring status checks..."
    
    # Create monitoring status check script
    cat << 'EOF' > "${SCRIPT_DIR}/monitoring-status.sh"
#!/bin/bash

# Get monitoring stack health status
get_stack_health() {
    kubectl get pods -n monitoring -o wide
}

# Get security monitoring status
get_security_status() {
    kubectl logs -l app=elk-stack,component=logstash -n monitoring --tail=100
}

# Main status check
echo "=== Monitoring Stack Health Status ==="
get_stack_health

echo -e "\n=== Security Monitoring Status ==="
get_security_status
EOF
    
    chmod +x "${SCRIPT_DIR}/monitoring-status.sh"
    log_info "Monitoring status check script created"
}

# Main execution
main() {
    log_info "Starting monitoring stack setup..."
    
    # Run setup steps
    check_prerequisites
    create_monitoring_namespace
    deploy_prometheus
    deploy_grafana
    deploy_jaeger
    deploy_enhanced_elk
    verify_monitoring_stack
    setup_monitoring_status_check
    
    log_info "Monitoring stack setup completed successfully"
    log_info "Use ./monitoring-status.sh to check monitoring stack status"
}

# Execute main function
main "$@"