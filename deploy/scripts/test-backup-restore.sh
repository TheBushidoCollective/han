#!/bin/bash
set -euo pipefail

scripts_dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/backups with spaces" "$tmp/-backups"

cat > "$tmp/bin/pg_dump" <<'EOF'
#!/bin/bash
printf 'SELECT 1;\n'
EOF
cat > "$tmp/bin/psql" <<'EOF'
#!/bin/bash
printf '%s\n' "$*" >> "$PSQL_LOG"
if [ "$#" -eq 1 ]; then
  cat > "$PSQL_DATA"
fi
EOF
cat > "$tmp/bin/ls" <<'EOF'
#!/bin/bash
if [ "${LS_FAIL:-0}" = 1 ]; then
  exit 13
fi
exec /bin/ls "$@"
EOF
chmod +x "$tmp/bin/pg_dump" "$tmp/bin/psql" "$tmp/bin/ls"
export PATH="$tmp/bin:$PATH" DATABASE_URL='postgres://localhost/example' PSQL_LOG="$tmp/psql.log" PSQL_DATA="$tmp/restored.sql"

backup_dir="$tmp/backups with spaces"
bash "$scripts_dir/backup.sh" "$backup_dir" > "$tmp/backup.out"
backup_file=$(find "$backup_dir" -name 'han_team_*.sql.gz' -print -quit)
[ -n "$backup_file" ]
awk '/Backup completed successfully:/ { found=1 } END { exit !found }' "$tmp/backup.out"

# Paths are never interpreted as options or split at spaces or newlines.
newline_file="$tmp/-backups/backup
name with spaces.sql.gz"
cp "$backup_file" "$newline_file"
printf 'R\\ESTORE\n' | bash "$scripts_dir/restore.sh" "$newline_file" > "$tmp/restore.out"
[ -s "$PSQL_LOG" ]
printf 'SELECT 1;\n' | cmp - "$PSQL_DATA"

# Escaped newlines continue the original read; escaped trailing spaces reject.
: > "$PSQL_LOG"
rm -f "$PSQL_DATA"
printf 'RES\\\nTORE\n' | bash "$scripts_dir/restore.sh" "$newline_file" > "$tmp/restore.out"
[ -s "$PSQL_LOG" ]
printf 'SELECT 1;\n' | cmp - "$PSQL_DATA"
: > "$PSQL_LOG"
if printf 'RESTORE\\ \n' | bash "$scripts_dir/restore.sh" "$newline_file" > "$tmp/restore.out"; then
  echo 'escaped trailing space unexpectedly confirmed restore' >&2
  exit 1
fi
[ ! -s "$PSQL_LOG" ]

# A failed ls must still fail the pipeline instead of being hidden by find.
if LS_FAIL=1 bash "$scripts_dir/backup.sh" "$backup_dir" > "$tmp/failure.out" 2>&1; then
  echo 'backup ignored ls failure' >&2
  exit 1
fi
if LS_FAIL=1 bash "$scripts_dir/restore.sh" "$newline_file" --confirm > "$tmp/failure.out" 2>&1; then
  echo 'restore ignored ls failure' >&2
  exit 1
fi
printf 'backup and restore fixture checks passed\n'
