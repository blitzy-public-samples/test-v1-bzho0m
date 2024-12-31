# Provider and Terraform configuration
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  backend "s3" {
    bucket         = "hotel-erp-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "hotel-erp-terraform-locks"
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project          = "hotel-management-erp"
      Environment      = var.environment
      ManagedBy        = "terraform"
      SecurityLevel    = "high"
      BackupRequired   = "true"
      ComplianceLevel  = "pci-dss"
    }
  }
}

# Kubernetes provider configuration
provider "kubernetes" {
  host                   = data.aws_eks_cluster.main.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.main.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.main.token
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", "${var.environment}-hotel-erp-cluster"]
  }
}

# Local variables
locals {
  common_tags = {
    Project             = "hotel-management-erp"
    Environment         = var.environment
    ManagedBy          = "terraform"
    SecurityLevel      = "high"
    BackupRequired     = "true"
    ComplianceLevel    = "pci-dss"
    CostCenter         = "hotel-ops"
    DataClassification = "confidential"
  }
}

# Data sources
data "aws_eks_cluster" "main" {
  name = "${var.environment}-hotel-erp-cluster"
  
  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_eks_cluster_auth" "main" {
  name = "${var.environment}-hotel-erp-cluster"
}

# Outputs
output "aws_region" {
  description = "AWS region where infrastructure is deployed"
  value       = var.aws_region
}

output "environment" {
  description = "Deployment environment name"
  value       = var.environment
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = data.aws_eks_cluster.main.endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = data.aws_eks_cluster.main.name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

# Module configurations will be referenced from other files
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr             = var.vpc_cidr
  environment          = var.environment
  private_subnet_cidrs = var.private_subnet_cidrs
  public_subnet_cidrs  = var.public_subnet_cidrs
  
  tags = local.common_tags
}

module "eks" {
  source = "./modules/eks"
  
  cluster_name         = "${var.environment}-hotel-erp-cluster"
  cluster_version      = var.eks_cluster_version
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  node_instance_types = var.eks_node_instance_types
  desired_nodes       = var.eks_desired_nodes
  
  tags = local.common_tags
}

module "rds" {
  source = "./modules/rds"
  
  identifier          = "${var.environment}-hotel-erp-db"
  instance_class      = var.rds_instance_class
  allocated_storage   = var.rds_allocated_storage
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  
  tags = local.common_tags
}

module "elasticache" {
  source = "./modules/elasticache"
  
  cluster_id          = "${var.environment}-hotel-erp-cache"
  node_type           = var.elasticache_node_type
  num_cache_nodes     = var.elasticache_num_cache_nodes
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  
  tags = local.common_tags
}