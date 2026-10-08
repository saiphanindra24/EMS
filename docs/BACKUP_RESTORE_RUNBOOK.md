# EMWTS Database Backup & Disaster Recovery Runbook

## Overview
This runbook defines the operational procedures for backing up, verifying, and restoring the EMWTS PostgreSQL database (`emwts_db`) in production and staging environments.

---

## 1. Architecture & Backup Strategy

| Parameter | Specification |
|:---|:---|
| **Database Engine** | PostgreSQL 16+ / 17 |
| **Backup Utility** | `pg_dump` with custom archive format (`-F c`) |
| **Restore Utility** | `pg_restore` with `--clean --if-exists` |
| **Backup Frequency** | Daily automated snapshot at 01:00 UTC |
| **Transaction Log (WAL) Archiving** | Continuous WAL archiving for Point-in-Time Recovery (PITR) |
| **Retention Policy** | 14 days locally / 90 days off-site object storage (AWS S3 / GCP GCS) |
| **Encryption at Rest** | AES-256 (GPG / AWS KMS-managed SSE-S3) |

---

## 2. Backup Execution

### Automated Script (Linux / Docker)
Run via scheduled cron or container daemon:
```bash
bash scripts/backup_db.sh
```

### Automated Script (Windows)
Run via Windows Task Scheduler:
```cmd
scripts\backup_db.bat
```

### Manual Backup Command
```bash
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -F c -b -v -f "/backups/emwts_db_$(date +%Y%m%d_%H%M%S).dump" emwts_db
```
- `-F c`: Custom PostgreSQL archive format (compressed, supports selective restoration and parallel threads).
- `-b`: Include large objects (BLOBs / attachments).
- `-v`: Verbose output for logging and audit trails.

---

## 3. Restoration Procedure

> [!CAUTION]
> Restoring a database will overwrite the current database tables and data. Ensure active traffic is drained and an ad-hoc safety backup is taken prior to restoring.

### Standard Recovery Procedure
1. **Drain API Traffic**:
   Put the frontend into maintenance mode or scale Django application pods/services down to zero:
   ```bash
   docker compose stop backend
   ```
2. **Execute Restore**:
   - **Linux / Docker**:
     ```bash
     bash scripts/restore_db.sh /backups/emwts_db_20261008_120000.dump
     ```
   - **Windows**:
     ```cmd
     scripts\restore_db.bat ..\backups\emwts_db_20261008_120000.dump
     ```
3. **Verify Database Integrity**:
   Verify migration status and execute database checks:
   ```bash
   python manage.py showmigrations
   python manage.py check
   ```
4. **Probe Healthcheck Endpoint**:
   ```bash
   curl -I http://127.0.0.1:8000/healthz/
   ```
5. **Resume Application Traffic**:
   ```bash
   docker compose start backend
   ```

---

## 4. Disaster Recovery & Replication Verification

- **Off-Site Sync**:
  Backups generated in `backups/` should be synchronized off-site using an automated CLI hook:
  ```bash
  aws s3 sync /backups/ s3://emwts-production-backups/postgres/ --sse aws:kms
  ```
- **Quarterly Drill**:
  Every quarter, restore the latest snapshot to an isolated staging instance and execute the automated test suite (`python manage.py test api`) to validate data consistency and referential integrity.
