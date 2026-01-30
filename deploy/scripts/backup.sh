#!/bin/bash
# Han Team Platform - Database Backup Script
# Usage: ./backup.sh [backup_dir] [s3_bucket]

set -euo pipefail

# Configuration
BACKUP_DIR="${1:-/var/backups/han-team}"
S3_BUCKET="${2:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="han_team_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is required"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)"
echo "Backup file: ${BACKUP_DIR}/${BACKUP_FILE}"

# Create backup
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify backup
if [ ! -s "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file is empty"
  exit 1
fi

BACKUP_SIZE=$(ls -lh "${BACKUP_DIR}/${BACKUP_FILE}" | awk '{print $5}')
echo "Backup completed successfully: ${BACKUP_SIZE}"

# Upload to S3 if bucket specified
if [ -n "$S3_BUCKET" ]; then
  echo "Uploading to S3: s3://${S3_BUCKET}/backups/${BACKUP_FILE}"
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/${BACKUP_FILE}"
  echo "S3 upload complete"
fi

# Cleanup old local backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "han_team_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Cleanup old S3 backups
if [ -n "$S3_BUCKET" ]; then
  echo "Cleaning up old S3 backups..."
  aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
    FILE_DATE=$(echo "$line" | awk '{print $1}')
    FILE_NAME=$(echo "$line" | awk '{print $4}')
    if [ -n "$FILE_NAME" ]; then
      AGE_DAYS=$(( ($(date +%s) - $(date -d "$FILE_DATE" +%s)) / 86400 ))
      if [ $AGE_DAYS -gt $RETENTION_DAYS ]; then
        echo "Deleting old backup: $FILE_NAME"
        aws s3 rm "s3://${S3_BUCKET}/backups/${FILE_NAME}"
      fi
    fi
  done
fi

echo "Backup completed at $(date)"

# List recent backups
echo ""
echo "Recent backups:"
ls -lht "$BACKUP_DIR" | head -10
