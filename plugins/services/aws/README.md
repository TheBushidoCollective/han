# AWS Plugin

Amazon Web Services integration for Claude Code, providing access to AWS resources, infrastructure management, and cloud operations.

## Features

- Manage S3 buckets and objects
- Explore EC2 instances and VPC configurations
- Work with Lambda functions
- Query CloudWatch metrics and logs
- Manage IAM roles and policies
- Access DynamoDB, RDS, and other services

## Installation

```bash
claude plugin install aws@han
```

## Configuration

Configure AWS credentials using one of these methods:

### Environment Variables

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

### AWS Credentials File

```bash
# ~/.aws/credentials
[default]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key

# ~/.aws/config
[default]
region = us-east-1
```

### Claude Code Settings

```json
{
  "env": {
    "AWS_ACCESS_KEY_ID": "your-access-key",
    "AWS_SECRET_ACCESS_KEY": "your-secret-key",
    "AWS_REGION": "us-east-1"
  }
}
```

## Usage

Once installed and configured, Claude can:

- **S3**: "List all S3 buckets", "Upload file to s3://bucket/path"
- **EC2**: "Show running EC2 instances", "Get instance details for i-1234567890"
- **Lambda**: "List Lambda functions", "Invoke function my-function"
- **CloudWatch**: "Show CPU metrics for instance i-123456"
- **IAM**: "List IAM roles", "Show policy attachments for role admin"

## Security Considerations

- Use IAM roles with least-privilege permissions
- Never commit credentials to version control
- Use AWS Secrets Manager for sensitive data
- Enable CloudTrail for audit logging
- Consider using temporary credentials (STS)

## MCP Server

This plugin uses the Anthropic AWS MCP server:
- Package: `@anthropic/mcp-server-aws`

## Learn Patterns

This plugin is automatically suggested when detecting:
- AWS CLI usage (`aws s3`, `aws ec2`)
- ARN references (`arn:aws:`)
- S3 URLs (`s3://`)
- AWS SDK imports (`boto3`, `@aws-sdk/`)
- AWS credential configurations
