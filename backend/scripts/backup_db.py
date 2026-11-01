#!/usr/bin/env python3
"""
Database Backup & Snapshot Utility for KnowledgeX AI.
Supports both SQLite local snapshots and PostgreSQL production pg_dump dumps.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
STORAGE_DIR = BACKEND_DIR / "storage"
BACKUPS_DIR = BACKEND_DIR / "backups"


def backup_sqlite():
    db_file = DATA_DIR / "knowledgex.db"
    if not db_file.exists():
        print(f"[WARN] SQLite file not found at: {db_file}")
        return False

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    target_backup = BACKUPS_DIR / f"knowledgex_backup_{timestamp}.db"

    # Use atomic file copy for SQLite
    shutil.copy2(db_file, target_backup)
    print(f"[SUCCESS] SQLite database successfully backed up to: {target_backup} ({target_backup.stat().st_size} bytes)")
    return True


def backup_postgres():
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    user = os.getenv("POSTGRES_USER", "knowledgex_user")
    db_name = os.getenv("POSTGRES_DB", "knowledgex")

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    target_sql = BACKUPS_DIR / f"knowledgex_pg_{timestamp}.sql"

    cmd = [
        "pg_dump",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", db_name,
        "-F", "c",
        "-f", str(target_sql),
    ]
    try:
        subprocess.run(cmd, check=True)
        print(f"[SUCCESS] PostgreSQL database dumped to: {target_sql}")
        return True
    except FileNotFoundError:
        print("[INFO] 'pg_dump' utility not found on PATH. Falling back to SQLite snapshot.")
        return backup_sqlite()
    except subprocess.CalledProcessError as exc:
        print(f"[ERROR] pg_dump failed: {exc}")
        return False


def main():
    print("=" * 60)
    print(" KnowledgeX AI - Automated Database Backup Routine")
    print("=" * 60)

    db_url = os.getenv("DATABASE_URL", "")
    if "postgresql" in db_url:
        success = backup_postgres()
    else:
        success = backup_sqlite()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
