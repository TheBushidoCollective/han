---
name: terraform-modules
description: Use when creating and using reusable Terraform modules for organizing and sharing infrastructure code.
allowed-tools: []
---

# Terraform Modules

Creating and using reusable Terraform modules.

## Module Structure

```
modules/vpc/
├── main.tf
├── variables.tf
├── outputs.tf
└── README.md
```

## Creating a Module

### main.tf

```hcl
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = var.enable_dns_hostnames
  
  tags = merge(var.tags, {
    Name = var.name
  })
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnets)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnets[count.index]
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(var.tags, {
    Name = "${var.name}-public-${count.index + 1}"
  })
}
```

### variables.tf

```hcl
variable "name" {
  description = "VPC name"
  type        = string
}

variable "cidr_block" {
  description = "VPC CIDR block"
  type        = string
}

variable "public_subnets" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
```

### outputs.tf

```hcl
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}
```

## Using Modules

### Local Module

```hcl
module "vpc" {
  source = "./modules/vpc"
  
  name        = "production-vpc"
  cidr_block  = "10.0.0.0/16"
  public_subnets = [
    "10.0.1.0/24",
    "10.0.2.0/24",
  ]
  
  tags = {
    Environment = "production"
  }
}

# Access module outputs
resource "aws_instance" "web" {
  subnet_id = module.vpc.public_subnet_ids[0]
}
```

### Registry Module

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"
  
  name = "my-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
}
```

### Git Module

```hcl
module "vpc" {
  source = "git::https://github.com/org/terraform-modules.git//vpc?ref=v1.0.0"
  
  name = "my-vpc"
  # ...
}
```

## Module Composition

```hcl
module "network" {
  source = "./modules/network"
  name   = var.name
}

module "compute" {
  source    = "./modules/compute"
  vpc_id    = module.network.vpc_id
  subnet_id = module.network.subnet_ids[0]
}

module "database" {
  source     = "./modules/database"
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
}
```

## For_each with Modules

```hcl
variable "applications" {
  type = map(object({
    instance_type = string
    ami_id        = string
  }))
}

module "application" {
  for_each = var.applications
  source   = "./modules/application"
  
  name          = each.key
  instance_type = each.value.instance_type
  ami_id        = each.value.ami_id
}
```

## Count with Modules

```hcl
module "worker" {
  count  = var.worker_count
  source = "./modules/worker"
  
  name  = "worker-${count.index + 1}"
  index = count.index
}
```

## Module Best Practices

### Version Pinning

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"  # Allow patch updates
}
```

### Input Validation

```hcl
variable "environment" {
  type = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
```

### Output Everything Useful

```hcl
output "vpc_id" {
  value = aws_vpc.main.id
}

output "vpc_cidr" {
  value = aws_vpc.main.cidr_block
}

output "subnet_ids" {
  value = aws_subnet.main[*].id
}
```

### Use Consistent Naming

```hcl
variable "name_prefix" {
  type = string
}

locals {
  name = "${var.name_prefix}-${var.environment}"
}
```

## Publishing Modules

### Module Registry Format

```
terraform-<PROVIDER>-<NAME>
terraform-aws-vpc
terraform-google-network
```

### Semantic Versioning

```
v1.0.0 - Major release
v1.1.0 - Minor release
v1.1.1 - Patch release
```
