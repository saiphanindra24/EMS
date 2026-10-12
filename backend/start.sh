#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "[*] Applying database migrations..."
python manage.py migrate --no-input

echo "[*] Ensuring database seed data is present..."
python manage.py seed_employees || true
python manage.py seed_leave_types || true
python manage.py seed_tasks || true

echo "[*] Launching Daphne ASGI application server..."
exec daphne -b 0.0.0.0 -p $PORT config.asgi:application
