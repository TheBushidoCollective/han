---
description: Explore AWS resources and infrastructure
---

# Explore AWS Resources

## Name

aws:explore-resources - Explore AWS resources and infrastructure

## Synopsis

```
/explore-resources [service] [filter]
```

## Description

Explore AWS resources across services. List EC2 instances, S3 buckets, Lambda functions, and other infrastructure components.

## Arguments

- `service` - Optional AWS service to explore (ec2, s3, lambda, rds, etc.)
- `filter` - Optional filter criteria

## Implementation

1. Use configured AWS credentials
2. If service specified, list resources for that service
3. If no service, provide overview of all major services
4. Apply any filters provided
5. Return formatted resource listing

## Example Interaction

```
User: /explore-resources ec2

Claude: Exploring EC2 resources in us-east-1...

Running Instances (3):
| Instance ID         | Type      | State   | Name          | IP            |
|---------------------|-----------|---------|---------------|---------------|
| i-0abc123def456789  | t3.medium | running | web-server-1  | 10.0.1.100    |
| i-0def456ghi789012  | t3.large  | running | api-server    | 10.0.2.50     |
| i-0ghi789jkl012345  | t3.micro  | running | bastion       | 10.0.0.10     |

Stopped Instances (1):
| Instance ID         | Type      | State   | Name          |
|---------------------|-----------|---------|---------------|
| i-0jkl012mno345678  | t3.small  | stopped | dev-server    |

Security Groups: 8
Key Pairs: 3
Elastic IPs: 2
```

## Notes

- Requires AWS credentials with appropriate read permissions
- Region is determined by AWS_REGION environment variable or config
- Large accounts may take longer to enumerate
