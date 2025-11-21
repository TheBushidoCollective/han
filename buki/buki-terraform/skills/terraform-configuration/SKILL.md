---
name: terraform-configuration
description: Use when writing and organizing Terraform infrastructure-as-code configurations for cloud resource provisioning.
allowed-tools: []
---

# Terraform Configuration

Writing and organizing Terraform infrastructure-as-code configurations.

## Basic Structure

```hcl
# Provider configuration
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.region
}
```

## Resources

```hcl
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = var.instance_type
  
  tags = {
    Name        = "web-server"
    Environment = var.environment
  }
  
  lifecycle {
    create_before_destroy = true
    prevent_destroy       = false
  }
}
```

## Variables

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "development"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
```

## Outputs

```hcl
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "public_ip" {
  description = "Public IP address"
  value       = aws_instance.web.public_ip
  sensitive   = false
}
```

## Data Sources

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

data "aws_vpc" "default" {
  default = true
}
```

## Locals

```hcl
locals {
  common_tags = {
    Project     = "myapp"
    ManagedBy   = "terraform"
    Environment = var.environment
  }
  
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_instance" "web" {
  # ...
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-web"
  })
}
```

## Common Commands

```bash
# Initialize
terraform init

# Format
terraform fmt -recursive

# Validate
terraform validate

# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# Destroy
terraform destroy

# Show state
terraform show

# List resources
terraform state list
```

## Best Practices

### File Organization

```
project/
├── main.tf          # Main resources
├── variables.tf     # Variable declarations
├── outputs.tf       # Output declarations
├── versions.tf      # Provider versions
├── terraform.tfvars # Variable values (gitignored if sensitive)
└── modules/         # Local modules
    └── network/
```

### Use Variables for Flexibility

```hcl
# Bad
resource "aws_instance" "web" {
  instance_type = "t2.micro"
}

# Good
resource "aws_instance" "web" {
  instance_type = var.instance_type
}
```

### Use Locals for Computed Values

```hcl
locals {
  timestamp = formatdate("YYYY-MM-DD-hhmmss", timestamp())
  full_name = "${var.prefix}-${var.name}-${var.suffix}"
}
```
