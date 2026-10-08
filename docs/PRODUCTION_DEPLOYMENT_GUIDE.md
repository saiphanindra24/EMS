# EMWTS Production Deployment Guide (React + Django + Neon + Vercel)

This guide provides the complete, step-by-step instructions for deploying the modernized EMWTS application to production using:
- **Database**: Neon Serverless PostgreSQL
- **Backend API**: Render (or Railway) running Django 6.1 with Gunicorn
- **Frontend**: Vercel hosting the React 19 / Vite SPA

---

## Architecture Overview

```
                                      +------------------------+
                                      |     Neon PostgreSQL    |
                                      |   (Serverless Cloud)   |
                                      +-----------^------------+
                                                  | SSL (sslmode=require)
                                                  | DATABASE_URL
+-----------------------+     REST API / JWT     +------------------------+
|     Vercel Frontend   | ---------------------> |     Render Backend     |
|   (React 19 / Vite)   | <--------------------- |  (Django 6.1 / Gunicorn|
|  https://emwts.app    |      CORS + Cookies    | https://api.emwts.app  |
+-----------------------+                        +------------------------+
```

---

## Step 1: Prepare Neon PostgreSQL Database

1. Log into your [Neon Console](https://console.neon.tech/).
2. Select your project (or create a new database `emwts_db`).
3. Under **Dashboard / Connection Details**, copy the **Connection String** (`postgresql://...`).
   Ensure it includes `sslmode=require`, for example:
   ```env
   DATABASE_URL=postgresql://neondb_owner:npg_xyz@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### (Optional) Apply Migrations & Seed to Neon Locally Before Deploy
You can run migrations directly from your local terminal against Neon:
```powershell
# From the backend directory:
$env:DATABASE_URL = "postgresql://neondb_owner:npg_xyz@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py create_initial_admin
.\venv\Scripts\python.exe manage.py seed_leave_types
.\venv\Scripts\python.exe manage.py seed_employees
```
*(Alternatively, Render's `build.sh` script runs `python manage.py migrate --no-input` automatically upon deployment).*

---

## Step 2: Deploy Django Backend on Render (or Railway)

### Option A: Using Render (Recommended)
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`fullstack-employee-management-system`).
4. Select the branch: `rebuild/react-django`.
5. Configure the service:
   - **Name**: `emwts-backend` (or your choice)
   - **Region**: Choose the region closest to your Neon database (e.g. `Ohio / us-east-2` or `Oregon / us-west-2`)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `bash build.sh`
   - **Start Command**: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --threads 2 --timeout 120`
6. Add the following **Environment Variables**:

| Variable | Value | Description |
|:---|:---|:---|
| `DJANGO_DEBUG` | `False` | Disables debug mode for production |
| `DJANGO_SECRET_KEY` | *(Click "Generate" or enter a 50+ char random string)* | Production Django secret key |
| `DATABASE_URL` | `postgresql://neondb_owner:...` | Your Neon database connection URI |
| `DJANGO_ALLOWED_HOSTS` | `emwts-backend.onrender.com,*.onrender.com` | Allowed hostnames |
| `FRONTEND_URL` | `https://your-app.vercel.app` *(update after Step 3)* | Allowed CORS origin |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` *(update after Step 3)* | Allowed frontend domain |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://your-app.vercel.app,https://emwts-backend.onrender.com` | CSRF trusted origins |
| `PYTHON_VERSION` | `3.12.3` | Python runtime version |

7. Click **Create Web Service**.
8. Render will install dependencies, collect static files, apply migrations to Neon, and start Gunicorn.
9. Verify health probe once live:
   `https://emwts-backend.onrender.com/healthz/`
   Response: `{"status": "healthy", "service": "EMWTS Backend API", ...}`

---

## Step 3: Deploy React Frontend on Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Select your repository (`fullstack-employee-management-system`).
4. In the Project Setup screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:
   - `VITE_API_URL`: `https://emwts-backend.onrender.com` *(your live Render backend URL from Step 2)*
6. Click **Deploy**.
7. Vercel will build the frontend bundle and provide your production URL (e.g. `https://emwts-frontend.vercel.app`).

---

## Step 4: Finalize CORS Handshake

1. Go back to Render -> `emwts-backend` -> **Environment Variables**.
2. Update:
   - `FRONTEND_URL` = `https://emwts-frontend.vercel.app`
   - `CORS_ALLOWED_ORIGINS` = `https://emwts-frontend.vercel.app`
   - `DJANGO_CSRF_TRUSTED_ORIGINS` = `https://emwts-frontend.vercel.app,https://emwts-backend.onrender.com`
3. Render will automatically redeploy with the updated CORS whitelist.

---

## Step 5: Post-Deployment Smoke Test

1. Open your Vercel URL: `https://emwts-frontend.vercel.app`.
2. Login using the Super Admin credentials:
   - **Email**: `admin@emwts.local`
   - **Password**: `AdminPass123!`
3. Verify:
   - [x] Dashboard loads with live employee counts and stats.
   - [x] Employees page loads directory from Neon database.
   - [x] Attendance check-in / check-out records accurately.
   - [x] Tasks creation and assignment functions properly.
   - [x] Leave request and approval workflows update balances.
   - [x] Reports preview tables display and CSV/Excel exports download authorized data.
   - [x] Organization settings update and audit logs record actions.
