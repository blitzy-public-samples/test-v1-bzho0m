# AWS Route53 configuration for Hotel Management ERP
# Version: ~> 5.0
# Provider: hashicorp/aws

# Import required variables from variables.tf
variable "cloudfront_domain_name" {
  description = "Domain name of CloudFront distribution"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "Hosted zone ID of CloudFront distribution"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of Application Load Balancer"
  type        = string
}

variable "alb_zone_id" {
  description = "Hosted zone ID of Application Load Balancer"
  type        = string
}

# Primary hosted zone for the Hotel Management ERP domain
resource "aws_route53_zone" "main" {
  name = "hotel-erp.${var.environment}.domain.com"
  comment = "Managed by Terraform - Hotel Management ERP ${var.environment} environment"
  force_destroy = false

  tags = {
    Environment    = var.environment
    Project       = "Hotel Management ERP"
    ManagedBy     = "Terraform"
    CostCenter    = "IT-Infrastructure"
    SecurityLevel = "High"
    BackupEnabled = "true"
  }
}

# Health check for web application endpoint
resource "aws_route53_health_check" "web_app" {
  fqdn              = "app.hotel-erp.${var.environment}.domain.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  measure_latency   = true
  regions          = ["us-west-1", "us-east-1", "eu-west-1"]

  tags = {
    Name        = "WebApp-HealthCheck"
    Environment = var.environment
  }
}

# Health check for API endpoint
resource "aws_route53_health_check" "api" {
  fqdn              = "api.hotel-erp.${var.environment}.domain.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health"
  failure_threshold = "2"
  request_interval  = "10"
  measure_latency   = true
  regions          = ["us-west-1", "us-east-1", "eu-west-1"]

  tags = {
    Name        = "API-HealthCheck"
    Environment = var.environment
  }
}

# A record for web application with CloudFront distribution
resource "aws_route53_record" "web_app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.hotel-erp.${var.environment}.domain.com"
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = var.cloudfront_hosted_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.web_app.id
  set_identifier  = "primary"
  
  failover_routing_policy {
    type = "PRIMARY"
  }
}

# A record for API endpoint with ALB
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.hotel-erp.${var.environment}.domain.com"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id               = var.alb_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.api.id
  set_identifier  = "primary"
  
  failover_routing_policy {
    type = "PRIMARY"
  }
}

# Output values for use in other Terraform configurations
output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "domain_names" {
  description = "Domain names for web application and API endpoints"
  value = {
    web_app = aws_route53_record.web_app.name
    api     = aws_route53_record.api.name
  }
}

output "health_check_ids" {
  description = "Health check IDs for monitoring and failover configuration"
  value = {
    web_app = aws_route53_health_check.web_app.id
    api     = aws_route53_health_check.api.id
  }
}