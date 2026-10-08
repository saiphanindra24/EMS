# EMWTS — Development Guide (React + Vite & Django REST Framework)

This documentation provides setup instructions, architectural specifications, and execution commands for the **EMWTS (Employee Management & Workplace Tracking System)** rebuild on the `rebuild/react-django` branch.

---

## 1. System Architecture Overview

The system uses a decoupled client-server architecture:
- **Frontend**: Single-Page Application (SPA) powered by **React 19** and **Vite 8** using JavaScript and modern styling (Vanilla CSS, custom design tokens).
- **Backend**: API service powered by **Django 6.1** and **Django REST Framework (DRF)**.
- **Primary Database**: **PostgreSQL 17/18** configured via `psycopg` (v3). SQLite is preserved only for legacy local inspection and is **not** used as the application database.
- **Legacy Preservation**: The original Next.js application remains preserved at the repository root and on branch `backup/nextjs-current`.

---

## 2. Prerequisites

- **Python**: 3.12+
- **Node.js**: 22 LTS (npm 10+)
- **PostgreSQL**: 16+ (Local Windows Service or Docker Container)
- **Git**

---

## 3. Database Setup (PostgreSQL)

### Option A: Local Windows PostgreSQL Service (Native)

If PostgreSQL is installed as a Windows service (e.g. `postgresql-x64-18` on port 5432):

Open Windows PowerShell:

```powershell
# Set PostgreSQL bin path if not in system PATH
$env:Path += ";C:\Program Files\PostgreSQL\18\bin;C:\Program Files\PostgreSQL\17\bin"

# Connect using psql as superuser and create dedicated database & user
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE USER emwts_user WITH PASSWORD 'emwts_secure_pass_2026';"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE emwts_db OWNER emwts_user;"
psql -U postgres -h 127.0.0.1 -p 5432 -c "GRANT ALL PRIVILEGES ON DATABASE emwts_db TO emwts_user;"
```

### Option B: Docker Compose (Containerized)

If Docker Desktop is running, you can spin up the dedicated PostgreSQL container:

```bash
docker compose -f backend/docker-compose.yml up -d
```

To stop:
```bash
docker compose -f backend/docker-compose.yml down
```

---

## 4. Environment Configuration

### Backend Environment (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```ini
# PostgreSQL Database Configuration
DB_NAME=emwts_db
DB_USER=emwts_user
DB_PASSWORD=emwts_secure_pass_2026
DB_HOST=127.0.0.1
DB_PORT=5432

# Django Application Configuration
DJANGO_SECRET_KEY=django-insecure-b2v-b+x0m@5rdc4k5!3q0=%^%x76c+gi#gzk+zgr(#v^+yhv!_
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost

# Frontend Client URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

> **Security Note:** `backend/.env` is excluded from Git via `.gitignore`. Never commit credentials to version control.

### Frontend Environment (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```ini
VITE_API_URL=http://127.0.0.1:8000
```

---

## 5. Verified Setup & Execution

### A. Backend (Django REST Framework)

Navigate to the `backend/` directory:

```bash
cd backend
```

#### 1. Setup Virtual Environment (if not already created)
```powershell
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 3. Run Migrations & System Checks
```bash
python manage.py check
python manage.py migrate
```

#### 4. Start Backend Server
```bash
python manage.py runserver 127.0.0.1:8000
```

#### 5. Verify Backend & Database Health
Query the health check endpoint:
[http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/)

Expected response:
```json
{
  "status": "success",
  "message": "EMWTS backend is connected",
  "database": {
    "status": "connected",
    "vendor": "postgresql",
    "name": "emwts_db"
  }
}
```

---

### B. Frontend (React + Vite)

Open a separate terminal and navigate to the `frontend/` directory:

```bash
cd frontend
```

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Lint & Build Checks
```bash
npm run lint
npm run build
```

#### 3. Start Development Server
```bash
npm run dev
```

Access the frontend application at: [http://localhost:5173/](http://localhost:5173/)

---

## 6. Database Backup & Restore Procedures

### Backup (pg_dump)

```powershell
# Windows PowerShell
$env:PGPASSWORD = "emwts_secure_pass_2026"
pg_dump -U emwts_user -h 127.0.0.1 -p 5432 -F c -b -v -f "emwts_db_backup.dump" emwts_db
```

### Restore (pg_restore)

```powershell
# Windows PowerShell
$env:PGPASSWORD = "emwts_secure_pass_2026"
pg_restore -U emwts_user -h 127.0.0.1 -p 5432 -d emwts_db -v "emwts_db_backup.dump"
```

> **Note:** Backup dumps (`*.dump`, `*.sql`, `*.bak`) are explicitly excluded from Git by `backend/.gitignore`.

---

## 7. Current Project Structure

```
fullstack-employee-management-system/
├── backend/
│   ├── config/              # Django core settings, asgi, wsgi, root urls
│   │   ├── settings.py      # PostgreSQL & python-dotenv configured
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── api/                 # Core API & database-aware health check
│   │   ├── views.py         # connection.ensure_connection() verification
│   │   └── urls.py
│   ├── apps/                # Modular Django apps (Milestone 3+)
│   ├── manage.py
│   ├── requirements.txt     # Pinned Python dependencies (including psycopg, python-dotenv)
│   ├── docker-compose.yml   # Containerized PostgreSQL service
│   ├── .env                 # Local secrets (git ignored)
│   ├── .env.example         # Template with placeholders
│   └── .gitignore           # Excludes venv, db.sqlite3, dumps, and .env
├── frontend/
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── assets/          # Icons, images
│   │   ├── components/      # UI components
│   │   ├── pages/           # Page views
│   │   ├── services/        # API client modules
│   │   ├── context/         # React Context providers
│   │   ├── App.jsx          # Root application layout
│   │   ├── App.css          # Layout styling
│   │   ├── index.css        # Base design tokens & typography
│   │   └── main.jsx         # React DOM mount point
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── .gitignore
└── DEVELOPMENT.md
```

---

## 8. Dependencies Planned for Future Milestones

*(Do NOT install yet — to be introduced incrementally per milestone requirements)*

### Backend
- `djangorestframework-simplejwt`: Token-based JWT authentication.
- `django-filter`: Advanced query filtering on employee, attendance, and task listings.
- `Pillow`: Image handling for employee avatars and uploaded document attachments.

### Frontend
- Client-side routing solution (e.g. `react-router-dom`).
- API request abstraction (`axios` or typed fetch wrapper).

---

## 9. Git Branch Strategy & Preservation Guarantees

1. `backup/nextjs-current`: Exact snapshot of the previous Next.js codebase. Do not rebase or push destructive changes.
2. `main`: Production release branch.
3. `rebuild/react-django`: Active working branch for the React + Vite and Django REST Framework implementation. All milestone commits must remain on this branch until final integration review.
