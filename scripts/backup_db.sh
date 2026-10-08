#!/usr/bin/env bash
# ==============================================================================
# EMWTS Automated PostgreSQL Database Backup Script (Linux / Production Docker)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load backend environment if available
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    # shellcheck disable=SC1091
    export $(grep -v '^#' "$PROJECT_ROOT/backend/.env" | xargs)
fi

DB_NAME="${DB_NAME:-emwts_db}"
DB_USER="${DB_USER:-emwts_user}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

echo "[*] [$(date -u)] Starting database backup for $DB_NAME..."
echo "[*] Connecting to $DB_HOST:$DB_PORT as $DB_USER..."

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$BACKUP_FILE" "$DB_NAME"

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[+] [$(date -u)] Database backup succeeded: $BACKUP_FILE ($BACKUP_SIZE)"

# Retain backups for 14 days locally
echo "[*] Pruning backup files older than 14 days in $BACKUP_DIR..."
find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.dump" -mtime +14 -exec rm -f {} \;
echo "[+] Maintenance finished."
