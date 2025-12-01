# Terraform Buki

Terraform configuration validation and infrastructure-as-code best practices.

## Features

- Validates Terraform configuration formatting with `terraform fmt`
- Validates Terraform syntax and configuration with `terraform validate`
- Provides skills for working with Terraform configurations, state, and modules

## Requirements

Install Terraform:

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

## Skills Included

- **terraform-configuration**: Writing and organizing Terraform configurations
- **terraform-state**: Managing Terraform state files
- **terraform-modules**: Creating reusable Terraform modules

## Hook Behavior

Validates Terraform configurations in directories containing `.tf` files using `terraform fmt` and `terraform validate`.

## Installation

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install buki-terraform
```
