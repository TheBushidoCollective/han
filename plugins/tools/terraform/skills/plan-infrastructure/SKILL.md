---
description: Plan and preview Terraform infrastructure changes
---

# Plan Terraform Infrastructure

## Name

terraform:plan-infrastructure - Plan and preview Terraform infrastructure changes

## Synopsis

```
/plan-infrastructure [target]
```

## Description

Run `terraform plan` to preview infrastructure changes. Shows what resources will be created, modified, or destroyed before applying.

## Arguments

- `target` - Optional resource address to target (e.g., `module.vpc`)

## Implementation

1. Ensure Terraform is initialized (`terraform init` if needed)
2. Run `terraform plan` with appropriate flags
3. If target specified, use `-target` flag
4. Parse and format the plan output
5. Highlight creates, updates, and deletes

## Example Interaction

```
User: /plan-infrastructure

Claude: Running terraform plan...

Terraform will perform the following actions:

  # aws_instance.web will be created
  + resource "aws_instance" "web" {
      + ami                          = "ami-0c55b159cbfafe1f0"
      + instance_type                = "t3.micro"
      + tags                         = {
          + "Name" = "web-server"
        }
    }

  # aws_security_group.web will be created
  + resource "aws_security_group" "web" {
      + name        = "web-sg"
      + description = "Security group for web server"
    }

Plan: 2 to add, 0 to change, 0 to destroy.

Would you like me to apply these changes?
```

## Notes

- Always review plan output before applying
- Use `-target` for focused changes (use sparingly)
- Plan output may vary based on provider state
