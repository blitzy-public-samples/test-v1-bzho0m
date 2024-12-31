# AWS Provider configuration
# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 Bucket for media files (guest documents, room images)
resource "aws_s3_bucket" "media_bucket" {
  bucket        = "${var.environment}-hotel-erp-media"
  force_destroy = false

  tags = merge(local.common_tags, {
    Name        = "${var.environment}-hotel-erp-media"
    Description = "Hotel ERP media storage for guest documents and room images"
    DataType    = "media"
  })
}

# S3 Bucket for system exports and reports
resource "aws_s3_bucket" "export_bucket" {
  bucket        = "${var.environment}-hotel-erp-exports"
  force_destroy = false

  tags = merge(local.common_tags, {
    Name        = "${var.environment}-hotel-erp-exports"
    Description = "Hotel ERP exports and reports storage"
    DataType    = "exports"
  })
}

# S3 Bucket for system backups
resource "aws_s3_bucket" "backup_bucket" {
  bucket        = "${var.environment}-hotel-erp-backups"
  force_destroy = false

  tags = merge(local.common_tags, {
    Name        = "${var.environment}-hotel-erp-backups"
    Description = "Hotel ERP system backups storage"
    DataType    = "backups"
  })
}

# Block public access for all buckets
resource "aws_s3_bucket_public_access_block" "media_bucket_public_access" {
  bucket = aws_s3_bucket.media_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "export_bucket_public_access" {
  bucket = aws_s3_bucket.export_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "backup_bucket_public_access" {
  bucket = aws_s3_bucket.backup_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for all buckets
resource "aws_s3_bucket_versioning" "media_bucket_versioning" {
  bucket = aws_s3_bucket.media_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "export_bucket_versioning" {
  bucket = aws_s3_bucket.export_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "backup_bucket_versioning" {
  bucket = aws_s3_bucket.backup_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption for all buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "media_bucket_encryption" {
  bucket = aws_s3_bucket.media_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "export_bucket_encryption" {
  bucket = aws_s3_bucket.export_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_bucket_encryption" {
  bucket = aws_s3_bucket.backup_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle rules for data retention
resource "aws_s3_bucket_lifecycle_rule" "media_lifecycle" {
  bucket = aws_s3_bucket.media_bucket.id
  id     = "media_lifecycle"
  status = "Enabled"

  transition {
    days          = 90
    storage_class = "STANDARD_IA"
  }

  transition {
    days          = 180
    storage_class = "INTELLIGENT_TIERING"
  }

  expiration {
    days = 1825  # 5 years retention
  }
}

resource "aws_s3_bucket_lifecycle_rule" "export_lifecycle" {
  bucket = aws_s3_bucket.export_bucket.id
  id     = "export_lifecycle"
  status = "Enabled"

  transition {
    days          = 30
    storage_class = "STANDARD_IA"
  }

  transition {
    days          = 90
    storage_class = "INTELLIGENT_TIERING"
  }

  expiration {
    days = 1825  # 5 years retention
  }
}

resource "aws_s3_bucket_lifecycle_rule" "backup_lifecycle" {
  bucket = aws_s3_bucket.backup_bucket.id
  id     = "backup_lifecycle"
  status = "Enabled"

  transition {
    days          = 30
    storage_class = "STANDARD_IA"
  }

  transition {
    days          = 90
    storage_class = "GLACIER"
  }

  expiration {
    days = 1825  # 5 years retention
  }
}

# Enable access logging
resource "aws_s3_bucket_logging" "media_bucket_logging" {
  bucket = aws_s3_bucket.media_bucket.id

  target_bucket = aws_s3_bucket.backup_bucket.id
  target_prefix = "log/media/"
}

resource "aws_s3_bucket_logging" "export_bucket_logging" {
  bucket = aws_s3_bucket.export_bucket.id

  target_bucket = aws_s3_bucket.backup_bucket.id
  target_prefix = "log/exports/"
}

# Output the bucket IDs for use in other modules
output "media_bucket_id" {
  description = "ID of the media storage bucket"
  value       = aws_s3_bucket.media_bucket.id
}

output "export_bucket_id" {
  description = "ID of the exports storage bucket"
  value       = aws_s3_bucket.export_bucket.id
}

output "backup_bucket_id" {
  description = "ID of the backups storage bucket"
  value       = aws_s3_bucket.backup_bucket.id
}