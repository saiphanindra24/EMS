#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "[*] Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "[*] Collecting static files..."
python manage.py collectstatic --no-input

echo "[*] Running database migrations..."
if [ -n "$DATABASE_URL" ]; then
    python manage.py migrate --no-input
else
    echo "[!] Notice: DATABASE_URL not detected in build environment. Skipping build-time migrations."
fi

echo "[+] Build script completed successfully."
