# RDS Configuration for Hotel Management ERP
# AWS Provider version ~> 5.0 required for latest RDS features

# Random password generation for RDS admin user
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# AWS KMS key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "${var.environment}-hotel-erp-rds-encryption-key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "${var.environment}-hotel-erp-rds-key"
    Environment = var.environment
  }
}

# KMS key alias
resource "aws_kms_alias" "rds" {
  name          = "alias/${var.environment}-hotel-erp-rds-key"
  target_key_id = aws_kms_key.rds.key_id
}

# RDS subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "main" {
  name        = "${var.environment}-hotel-erp-rds-subnet-group"
  description = "Subnet group for Hotel ERP RDS instance"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-hotel-erp-rds-subnet-group"
    Environment = var.environment
  }
}

# Security group for RDS instance
resource "aws_security_group" "rds" {
  name        = "${var.environment}-hotel-erp-rds-sg"
  description = "Security group for Hotel ERP RDS instance"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL access from private subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }

  tags = {
    Name        = "${var.environment}-hotel-erp-rds-sg"
    Environment = var.environment
  }
}

# RDS parameter group with optimized settings
resource "aws_db_parameter_group" "main" {
  family = "postgres13"
  name   = "${var.environment}-hotel-erp-pg13"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "8GB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "24GB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2GB"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16MB"
  }

  parameter {
    name  = "default_statistics_target"
    value = "100"
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  parameter {
    name  = "effective_io_concurrency"
    value = "200"
  }

  parameter {
    name  = "work_mem"
    value = "64MB"
  }

  tags = {
    Name        = "${var.environment}-hotel-erp-pg13"
    Environment = var.environment
  }
}

# IAM role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.environment}-hotel-erp-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-hotel-erp-rds-monitoring"
    Environment = var.environment
  }
}

# Attach the enhanced monitoring policy to the role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Main RDS instance
resource "aws_db_instance" "main" {
  identifier     = "${var.environment}-hotel-erp-db"
  engine         = "postgres"
  engine_version = "13.12"

  # Instance configuration
  instance_class = var.rds_instance_class
  multi_az      = true

  # Storage configuration
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = 1000
  storage_type         = "gp3"
  iops                 = 3000
  storage_encrypted    = true
  kms_key_id          = aws_kms_key.rds.arn

  # Database configuration
  db_name  = "hotel_erp"
  username = "admin"
  password = random_password.db_password.result
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  # Backup configuration
  backup_retention_period = 35
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Monitoring and logging
  monitoring_interval             = 60
  monitoring_role_arn            = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  # Additional configuration
  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.environment}-hotel-erp-db-final"
  copy_tags_to_snapshot    = true

  tags = {
    Name        = "${var.environment}-hotel-erp-db"
    Environment = var.environment
    Project     = "hotel-management-erp"
  }
}

# Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "rds_monitoring_role_arn" {
  description = "The ARN of the RDS monitoring role"
  value       = aws_iam_role.rds_monitoring.arn
}