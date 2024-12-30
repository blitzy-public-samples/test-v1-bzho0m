# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudFront Origin Access Identity for secure S3 access
resource "aws_cloudfront_origin_access_identity" "default" {
  comment = "${var.environment}-hotel-erp-frontend-oai"
}

# CloudFront Function for Security Headers
resource "aws_cloudfront_function" "security_headers" {
  name    = "${var.environment}-security-headers"
  runtime = "cloudfront-js-1.0"
  comment = "Add security headers to all responses"
  publish = true
  code    = <<-EOF
    function handler(event) {
      var response = event.response;
      var headers = response.headers;
      
      headers['strict-transport-security'] = { value: 'max-age=31536000; includeSubdomains; preload'};
      headers['x-content-type-options'] = { value: 'nosniff'};
      headers['x-frame-options'] = { value: 'DENY'};
      headers['x-xss-protection'] = { value: '1; mode=block'};
      headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin'};
      headers['content-security-policy'] = {
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.hotel-erp.com"
      };
      
      return response;
    }
  EOF
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled    = true
  http_version       = "http2and3"
  comment            = "${var.environment}-hotel-erp-frontend"
  default_root_object = "index.html"
  price_class        = var.environment == "prod" ? "PriceClass_All" : "PriceClass_100"
  
  # Custom domain configuration
  aliases = [
    "${var.environment == "prod" ? "app" : var.environment}.hotel-erp.com"
  ]

  # SPA routing support
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Origin configuration
  origin {
    domain_name = aws_s3_bucket.media_bucket.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.media_bucket.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.default.cloudfront_access_identity_path
    }

    # Origin shield for improved cache hit ratio
    origin_shield {
      enabled = var.environment == "prod"
      region  = var.aws_region
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.media_bucket.id}"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    # Security headers function association
    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
  }

  # Static assets cache behavior
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.media_bucket.id}"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 24 hours
    max_ttl                = 31536000 # 1 year

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Geo restriction
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.frontend_certificate.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # WAF association
  web_acl_id = aws_wafv2_web_acl.frontend_web_acl.arn

  # Access logging
  logging_config {
    include_cookies = false
    bucket         = aws_s3_bucket.logs.bucket_domain_name
    prefix         = "cloudfront/"
  }

  tags = {
    Environment = var.environment
    Service     = "hotel-erp-frontend"
    Managed     = "terraform"
  }
}

# Outputs
output "cloudfront_distribution_id" {
  description = "The identifier for the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "The domain name corresponding to the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "The CloudFront Route 53 zone ID for DNS alias records"
  value       = aws_cloudfront_distribution.frontend.hosted_zone_id
}