---
title: Backup and Restore
description: Protect your Han Team Platform data
---

# Backup and Restore

Regular backups are essential for protecting your Han Team Platform data. This guide covers backup strategies for different deployment methods.

## Backup Strategy

### What to Backup

| Data | Priority | Frequency |
|------|----------|-----------|
| PostgreSQL database | Critical | Daily minimum |
| Redis (session data) | Medium | Hourly (optional) |
| Configuration files | Low | On change |

### Retention Policy

We recommend:
- **Daily backups**: Keep for 30 days
- **Weekly backups**: Keep for 90 days
- **Monthly backups**: Keep for 1 year

## Docker Compose

### Manual Backup

```bash
cd deploy/docker-compose

# Backup PostgreSQL
docker compose exec -T db pg_dump -U han han_team | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup Redis
docker compose exec redis redis-cli SAVE
docker compose cp redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

### Automated Backup Script

Create a cron job using our backup script:

```bash
# Copy the backup script
cp deploy/scripts/backup.sh /usr/local/bin/han-backup

# Make executable
chmod +x /usr/local/bin/han-backup

# Set environment
export DATABASE_URL="postgres://han:password@localhost:5432/han_team"
export BACKUP_DIR="/var/backups/han-team"
export BACKUP_RETENTION_DAYS=30

# Test it
/usr/local/bin/han-backup

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/han-backup >> /var/log/han-backup.log 2>&1" | crontab -
```

### Restore from Backup

```bash
# Stop the API
docker compose stop api

# Restore PostgreSQL
gunzip -c backup_20250130_120000.sql.gz | docker compose exec -T db psql -U han han_team

# Start the API
docker compose start api

# Verify
curl http://localhost:3000/ready
```

## Kubernetes

### Using kubectl

```bash
# Get pod name
POD=$(kubectl get pods -n han-team -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')

# Backup
kubectl exec -n han-team $POD -- pg_dump -U han han_team | gzip > backup.sql.gz

# Restore
gunzip -c backup.sql.gz | kubectl exec -i -n han-team $POD -- psql -U han han_team
```

### Using CronJob

The Helm chart includes an optional backup CronJob:

```yaml
# values.yaml
backup:
  enabled: true
  schedule: "0 2 * * *"  # Daily at 2 AM
  storage:
    class: standard
    size: 50Gi
```

### Using Velero (Recommended)

For production Kubernetes clusters, use Velero for comprehensive backups:

```bash
# Install Velero
velero install \
  --provider aws \
  --bucket my-backup-bucket \
  --secret-file ./credentials-velero

# Create backup schedule
velero schedule create han-team-daily \
  --schedule="0 2 * * *" \
  --include-namespaces han-team \
  --ttl 720h

# Manual backup
velero backup create han-team-backup-manual \
  --include-namespaces han-team

# Restore
velero restore create --from-backup han-team-backup-manual
```

## Cloud Backups

### AWS S3

```bash
# Set S3 bucket
export S3_BUCKET=my-company-backups

# Run backup with S3 upload
./deploy/scripts/backup.sh /tmp/backups $S3_BUCKET
```

### Google Cloud Storage

```bash
# Backup to GCS
pg_dump $DATABASE_URL | gzip | gsutil cp - gs://my-bucket/backups/han_team_$(date +%Y%m%d).sql.gz

# Set lifecycle policy for retention
gsutil lifecycle set lifecycle.json gs://my-bucket
```

### Azure Blob Storage

```bash
# Backup to Azure
pg_dump $DATABASE_URL | gzip | az storage blob upload \
  --container backups \
  --name han_team_$(date +%Y%m%d).sql.gz \
  --file -
```

## Restore Procedures

### Full Restore

Use our restore script for a complete database restore:

```bash
# Set database URL
export DATABASE_URL="postgres://han:password@localhost:5432/han_team"

# Restore from local file
./deploy/scripts/restore.sh /path/to/backup.sql.gz --confirm

# Restore from S3
./deploy/scripts/restore.sh s3://bucket/backups/backup.sql.gz --confirm
```

### Point-in-Time Recovery

For mission-critical deployments, enable PostgreSQL WAL archiving:

```yaml
# PostgreSQL configuration (via Helm)
postgresql:
  primary:
    extraEnvVars:
      - name: POSTGRES_INITDB_ARGS
        value: "--data-checksums"
    configuration: |
      archive_mode = on
      archive_command = 'gzip < %p > /archive/%f.gz'
      wal_level = replica
```

## Testing Backups

**Always test your backups!** Schedule regular restore tests:

```bash
# Create test database
docker run -d --name restore-test \
  -e POSTGRES_PASSWORD=test \
  postgres:16-alpine

# Restore to test database
gunzip -c backup.sql.gz | docker exec -i restore-test psql -U postgres

# Verify data
docker exec restore-test psql -U postgres -c "SELECT COUNT(*) FROM teams;"

# Cleanup
docker rm -f restore-test
```

## Monitoring Backups

### Alerts

Set up alerts for:
- Backup job failures
- Backup age > 25 hours
- Backup size anomalies (sudden drops)

### Prometheus Metrics

```yaml
# Alert rule
- alert: HanTeamBackupMissing
  expr: time() - han_team_last_backup_timestamp > 90000
  for: 1h
  labels:
    severity: critical
  annotations:
    summary: "Han Team backup is overdue"
```

## Disaster Recovery

### Recovery Time Objective (RTO)

| Deployment | Target RTO |
|------------|-----------|
| Development | 4 hours |
| Production (single region) | 1 hour |
| Production (multi-region) | 15 minutes |

### Recovery Point Objective (RPO)

| Backup Strategy | RPO |
|-----------------|-----|
| Daily backups | 24 hours |
| Continuous WAL archiving | Minutes |
| Managed DB with PITR | Seconds |

### Runbook

1. **Assess the situation** - Determine scope of data loss
2. **Notify stakeholders** - Communication is critical
3. **Restore from backup** - Use most recent verified backup
4. **Verify data integrity** - Check key tables and counts
5. **Resume service** - Gradually restore traffic
6. **Post-mortem** - Document and improve
