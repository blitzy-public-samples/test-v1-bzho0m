#!/bin/bash

# SSL/TLS Certificate Renewal Script for Hotel Management ERP
# Version: 1.0.0
# Purpose: Automate certificate lifecycle management with security and compliance
# Dependencies:
# - kubectl v1.26+
# - openssl v3.0+
# - jq v1.6+

set -euo pipefail

# Global Configuration
CERT_RENEWAL_THRESHOLD_DAYS=30
CERT_CHECK_INTERVAL=86400
LOG_FILE="/var/log/ssl-renewal.log"
BACKUP_PATH="/var/backups/certificates"
METRICS_ENDPOINT="http://localhost:9090/metrics"
MAX_RETRY_ATTEMPTS=3
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_PERIOD=300

# Logging Configuration
setup_logging() {
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting certificate renewal check"
}

# Monitoring metrics export
export_metrics() {
    local metric_name=$1
    local metric_value=$2
    local metric_labels=$3
    
    curl -X POST "${METRICS_ENDPOINT}/api/v1/import/prometheus" \
        -H "Content-Type: text/plain" \
        --data "${metric_name}{${metric_labels}} ${metric_value}"
}

# Certificate validation function
validate_cert() {
    local cert_name=$1
    local namespace=$2
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Validating certificate: ${cert_name} in namespace: ${namespace}"
    
    # Extract certificate from secret
    kubectl get secret "${cert_name}" -n "${namespace}" -o jsonpath='{.data.tls\.crt}' | base64 -d > "/tmp/${cert_name}.crt"
    
    # Validate certificate properties
    local validation_results
    validation_results=$(openssl x509 -in "/tmp/${cert_name}.crt" -text -noout)
    
    # Check key strength
    local key_strength
    key_strength=$(openssl x509 -in "/tmp/${cert_name}.crt" -noout -pubkey | 
                  openssl rsa -pubin -text -noout 2>/dev/null | 
                  grep "Public-Key:" | 
                  awk '{print $2}')
    
    if [[ ${key_strength} -lt 2048 ]]; then
        echo "ERROR: Certificate key strength below required 2048 bits: ${key_strength}"
        return 1
    fi
    
    # Verify cipher suite compatibility
    if ! openssl x509 -in "/tmp/${cert_name}.crt" -noout -text | grep -q "TLS 1.3"; then
        echo "ERROR: Certificate not compatible with TLS 1.3"
        return 1
    fi
    
    # Clean up temporary files
    rm -f "/tmp/${cert_name}.crt"
    
    return 0
}

# Check certificate expiration
check_cert_expiry() {
    local namespace=$1
    local threshold_days=${2:-$CERT_RENEWAL_THRESHOLD_DAYS}
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking certificates in namespace: ${namespace}"
    
    # Get all TLS secrets in namespace
    local certs
    certs=$(kubectl get certificates -n "${namespace}" -o json)
    
    # Process each certificate
    echo "${certs}" | jq -r '.items[] | @base64' | while read -r cert; do
        local cert_name
        cert_name=$(echo "${cert}" | base64 -d | jq -r '.metadata.name')
        local expiry
        expiry=$(echo "${cert}" | base64 -d | jq -r '.status.notAfter')
        
        # Calculate days until expiry
        local expiry_date
        expiry_date=$(date -d "${expiry}" +%s)
        local current_date
        current_date=$(date +%s)
        local days_remaining
        days_remaining=$(( (expiry_date - current_date) / 86400 ))
        
        # Export metrics
        export_metrics "ssl_certificate_days_remaining" "${days_remaining}" \
            "certificate=\"${cert_name}\",namespace=\"${namespace}\""
        
        if [[ ${days_remaining} -le ${threshold_days} ]]; then
            echo "Certificate ${cert_name} expires in ${days_remaining} days"
            trigger_renewal "${cert_name}" "${namespace}"
        fi
    done
}

# Trigger certificate renewal
trigger_renewal() {
    local cert_name=$1
    local namespace=$2
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Triggering renewal for: ${cert_name}"
    
    # Create backup directory if it doesn't exist
    mkdir -p "${BACKUP_PATH}/${namespace}"
    
    # Backup existing certificate
    kubectl get secret "${cert_name}" -n "${namespace}" -o yaml > \
        "${BACKUP_PATH}/${namespace}/${cert_name}-$(date +%Y%m%d%H%M%S).yaml"
    
    # Delete existing certificate to trigger renewal
    kubectl delete certificate "${cert_name}" -n "${namespace}"
    
    # Wait for new certificate
    local attempts=0
    while [[ ${attempts} -lt ${MAX_RETRY_ATTEMPTS} ]]; do
        if kubectl wait --for=condition=Ready certificate/"${cert_name}" -n "${namespace}" --timeout=300s; then
            echo "Certificate renewed successfully"
            
            # Validate new certificate
            if validate_cert "${cert_name}" "${namespace}"; then
                # Clean up old backups (keep last 5)
                find "${BACKUP_PATH}/${namespace}" -name "${cert_name}-*.yaml" -type f | 
                    sort -r | tail -n +6 | xargs rm -f
                
                # Export success metric
                export_metrics "ssl_certificate_renewal_success" "1" \
                    "certificate=\"${cert_name}\",namespace=\"${namespace}\""
                return 0
            fi
        fi
        
        attempts=$((attempts + 1))
        sleep 60
    done
    
    # Export failure metric
    export_metrics "ssl_certificate_renewal_failure" "1" \
        "certificate=\"${cert_name}\",namespace=\"${namespace}\""
    return 1
}

# Main function
main() {
    setup_logging
    
    # Check required tools
    for cmd in kubectl openssl jq curl; do
        if ! command -v "${cmd}" >/dev/null 2>&1; then
            echo "ERROR: Required command not found: ${cmd}"
            exit 1
        fi
    done
    
    # Create required directories
    mkdir -p "${BACKUP_PATH}"
    
    # Check certificates in production namespace
    check_cert_expiry "hotel-erp-prod"
    
    # Clean up old logs (keep last 30 days)
    find "$(dirname "${LOG_FILE}")" -name "$(basename "${LOG_FILE}")*" -type f -mtime +30 -delete
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Certificate renewal check completed"
}

# Execute main function with error handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    trap 'echo "Error on line $LINENO"' ERR
    main "$@"
fi