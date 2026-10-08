#!/usr/bin/env bash
# ==============================================================================
# EMWTS PostgreSQL Database Restore Script (Linux / Production Docker)
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "[!] Usage: $0 <path_to_backup_dump_file>"
    echo "[!] Example: $0 /backups/emwts_db_20261008_120000.dump"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "[!] ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    # shellcheck disable=SC1091
    export $(grep -v '^#' "$PROJECT_ROOT/backend/.env" | xargs)
fi

DB_NAME="${DB_NAME:-emwts_db}"
DB_USER="${DB_USER:-emwts_user}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"

echo "[!] WARNING: You are about to restore '$DB_NAME' from '$BACKUP_FILE'."
read -rp "Are you sure you want to overwrite '$DB_NAME'? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "[*] Restore aborted."
    exit 0
fi

echo "[*] Running pg_restore with --clean --if-exists..."
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -v "$BACKUP_FILE"
echo "[+] Restore completed successfully."
