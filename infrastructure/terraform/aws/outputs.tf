# Terraform configuration block with required providers
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# VPC and Networking Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

# EKS Cluster Outputs
output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "Security group ID for EKS cluster"
  value       = module.eks.cluster_security_group_id
}

# RDS Database Outputs
output "rds_endpoint" {
  description = "Endpoint for RDS PostgreSQL instance"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "Port number for RDS PostgreSQL instance"
  value       = module.rds.port
  sensitive   = false
}

# ElastiCache Outputs
output "elasticache_endpoint" {
  description = "Endpoint for ElastiCache Redis cluster"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "elasticache_port" {
  description = "Port number for ElastiCache Redis cluster"
  value       = module.elasticache.port
  sensitive   = false
}

# CloudFront Distribution Outputs
output "cloudfront_distribution_id" {
  description = "ID of CloudFront distribution for web frontend"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "Domain name of CloudFront distribution"
  value       = module.cloudfront.domain_name
}

# Route53 DNS Outputs
output "route53_zone_id" {
  description = "ID of Route53 hosted zone"
  value       = module.route53.zone_id
}

output "route53_domain_name" {
  description = "Domain name of Route53 hosted zone"
  value       = module.route53.domain_name
}