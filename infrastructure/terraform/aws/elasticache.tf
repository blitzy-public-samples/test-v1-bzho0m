# AWS ElastiCache Redis configuration for Hotel Management ERP
# Provider version ~> 5.0 for latest features and security updates

# KMS key for Redis encryption
resource "aws_kms_key" "redis" {
  description             = "KMS key for Redis encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "${var.environment}-hotel-erp-redis-key"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# KMS key alias
resource "aws_kms_alias" "redis" {
  name          = "alias/${var.environment}-hotel-erp-redis"
  target_key_id = aws_kms_key.redis.key_id
}

# SNS topic for Redis notifications
resource "aws_sns_topic" "redis_notifications" {
  name = "${var.environment}-hotel-erp-redis-notifications"

  tags = {
    Name        = "${var.environment}-hotel-erp-redis-notifications"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ElastiCache subnet group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.environment}-hotel-erp-cache-subnet"
  description = "Hotel ERP Redis subnet group"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-hotel-erp-cache-subnet"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ElastiCache parameter group
resource "aws_elasticache_parameter_group" "main" {
  family      = "redis7"
  name        = "${var.environment}-hotel-erp-cache-params"
  description = "Hotel ERP Redis parameter group with enhanced security and performance"

  # Performance optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  # Security parameters
  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name        = "${var.environment}-hotel-erp-cache-params"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.environment}-hotel-erp-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "Allow Redis access from application security group"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.environment}-hotel-erp-redis-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ElastiCache replication group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.environment}-hotel-erp-cache"
  description         = "Hotel ERP Redis cluster with encryption and auto-failover"

  # Node configuration
  node_type                  = var.elasticache_node_type
  num_cache_clusters         = var.elasticache_num_cache_nodes
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name         = aws_elasticache_subnet_group.main.name
  security_group_ids        = [aws_security_group.redis.id]

  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled          = true
  preferred_cache_cluster_azs = data.aws_availability_zones.available.names

  # Engine configuration
  engine                    = "redis"
  engine_version           = "7.0"

  # Encryption configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  kms_key_id               = aws_kms_key.redis.arn

  # Monitoring and maintenance
  notification_topic_arn    = aws_sns_topic.redis_notifications.arn
  snapshot_retention_limit  = 7
  snapshot_window          = "00:00-04:00"
  maintenance_window       = "sun:05:00-sun:09:00"
  auto_minor_version_upgrade = true
  apply_immediately        = false

  tags = {
    Name        = "${var.environment}-hotel-erp-cache"
    Environment = var.environment
    ManagedBy   = "terraform"
    Encryption  = "true"
    Backup      = "enabled"
  }
}

# CloudWatch alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.environment}-hotel-erp-redis-cpu"
  alarm_description   = "Redis cluster CPU utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ElastiCache"
  period             = "300"
  statistic          = "Average"
  threshold          = "75"
  alarm_actions      = [aws_sns_topic.redis_notifications.arn]
  ok_actions         = [aws_sns_topic.redis_notifications.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = {
    Name        = "${var.environment}-hotel-erp-redis-cpu-alarm"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Outputs for other modules
output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_connection_info" {
  description = "Redis connection information"
  value = {
    endpoint     = aws_elasticache_replication_group.main.primary_endpoint_address
    port         = aws_elasticache_replication_group.main.port
    auth_enabled = true
  }
  sensitive = true
}