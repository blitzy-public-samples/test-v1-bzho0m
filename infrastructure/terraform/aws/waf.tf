# AWS WAF configuration for Hotel Management ERP
# Provider version: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common tags
locals {
  common_tags = {
    Environment = var.environment
    Project     = "hotel-erp"
    ManagedBy   = "terraform"
  }
}

# WAF Web ACL for CloudFront distribution
resource "aws_wafv2_web_acl" "frontend" {
  name        = "${var.environment}-hotel-erp-waf"
  description = "WAF rules for Hotel Management ERP frontend"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # AWS Managed Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # AWS Managed Known Bad Inputs Rule Set
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection Prevention Rule Set
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # IP Rate Limiting Rule
  rule {
    name     = "IPRateLimit"
    priority = 4

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "IPRateLimitMetric"
      sampled_requests_enabled  = true
    }
  }

  # Geographic Restriction Rule
  rule {
    name     = "GeoRestriction"
    priority = 5

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = ["RU", "CN", "KP", "IR"] # Restricted countries
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "GeoRestrictionMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "HotelERPWAFMetrics"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}

# CloudWatch Log Group for WAF logs
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/waf/${var.environment}-hotel-erp"
  retention_in_days = 30
  tags              = local.common_tags
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "waf_logging" {
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]
  resource_arn           = aws_wafv2_web_acl.frontend.arn

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# WAF Web ACL Association with CloudFront (if needed)
resource "aws_wafv2_web_acl_association" "cloudfront" {
  resource_arn = var.cloudfront_distribution_arn # This should be provided as a variable
  web_acl_arn  = aws_wafv2_web_acl.frontend.arn
}

# Outputs
output "web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.frontend.arn
}

output "web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.frontend.id
}

# Variables
variable "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution to associate with WAF"
  type        = string
}