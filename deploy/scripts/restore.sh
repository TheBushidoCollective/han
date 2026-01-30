#!/bin/bash
# Han Team Platform - Database Restore Script
# Usage: ./restore.sh <backup_file> [--confirm]

set -euo pipefail

BACKUP_FILE="${1:-}"
CONFIRM="${2:-}"

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file> [--confirm]"
  echo ""
  echo "Arguments:"
  echo "  backup_file  Path to .sql.gz backup file or S3 URI"
  echo "  --confirm    Skip confirmation prompt"
  echo ""
  echo "Examples:"
  echo "  ./restore.sh /var/backups/han-team/han_team_20250130_120000.sql.gz"
  echo "  ./restore.sh s3://my-bucket/backups/han_team_20250130_120000.sql.gz"
  exit 1
fi

# Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is required"
  exit 1
fi

# Download from S3 if needed
TEMP_FILE=""
if [[ "$BACKUP_FILE" == s3://* ]]; then
  echo "Downloading from S3: $BACKUP_FILE"
  TEMP_FILE=$(mktemp)
  aws s3 cp "$BACKUP_FILE" "$TEMP_FILE"
  BACKUP_FILE="$TEMP_FILE"
fi

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Show backup info
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "Backup file: $BACKUP_FILE"
echo "Backup size: $BACKUP_SIZE"

# Extract database name from URL
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
echo "Target database: $DB_NAME"

# Confirmation
if [ "$CONFIRM" != "--confirm" ]; then
  echo ""
  echo "WARNING: This will DROP and recreate the database '$DB_NAME'"
  echo "All existing data will be PERMANENTLY LOST"
  echo ""
  read -p "Type 'RESTORE' to confirm: " CONFIRMATION
  if [ "$CONFIRMATION" != "RESTORE" ]; then
    echo "Restore cancelled"
    exit 1
  fi
fi

echo ""
echo "Starting restore at $(date)"

# Create connection URL without database name for admin operations
ADMIN_URL=$(echo "$DATABASE_URL" | sed -E 's|/[^/]+(\?.*)?$|/postgres\1|')

# Terminate existing connections
echo "Terminating existing connections..."
psql "$ADMIN_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" || true

# Drop and recreate database
echo "Dropping database '$DB_NAME'..."
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"

echo "Creating database '$DB_NAME'..."
psql "$ADMIN_URL" -c "CREATE DATABASE \"$DB_NAME\";"

# Restore backup
echo "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "Restore completed at $(date)"

# Cleanup temp file
if [ -n "$TEMP_FILE" ]; then
  rm -f "$TEMP_FILE"
fi

# Verify restore
echo ""
echo "Verifying restore..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

echo ""
echo "Restore completed successfully!"
