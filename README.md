# VolkssKatt — Employee Management & Training System

## Which project am I setting up?

**This repository uses Next.js 16, React 19, TypeScript, Tailwind CSS, Drizzle ORM, and PostgreSQL.** Next.js serves both the React interface and the REST endpoints in one application. Authentication uses JWT cookies and bcrypt password hashes.

Although the original brief discussed Django/DRF and Vite, **this implementation is not a Django or Vite project**. There is no `manage.py`, Python virtual environment, or separate frontend/backend server to start. Do not create another project with `create-next-app` or `npm create vite`.

These instructions set up a **local development/demo environment**, not a production deployment.

## 1. Install the prerequisites

- [Visual Studio Code](https://code.visualstudio.com/).
- **Node.js 22 LTS**, including npm: [download Node.js](https://nodejs.org/en/download). The included `.nvmrc` also selects Node 22 for developers using nvm.
- **Docker Desktop** with Docker Compose v2: [installation guide](https://docs.docker.com/desktop/). Start Docker Desktop before continuing. On Linux, Docker Engine with the Compose v2 plugin also works.
- Git is optional if you download a ZIP; it is needed if you clone a repository.

Already have native or hosted PostgreSQL? You can skip Docker and follow the alternative below.

## 2. Open the existing source folder

1. Export/download this workspace's source code, or clone the repository where you saved it.
2. Extract the ZIP if applicable.
3. In VS Code, choose **File → Open Folder** and select the folder containing `package.json`, `src`, `scripts`, and this README. Do not open only the `src` folder.
4. Choose **Terminal → New Terminal**. Run every command below from this project root.
5. When VS Code offers recommended extensions, install **ESLint** and **Tailwind CSS IntelliSense**.

Check the tools:

```sh
node --version
npm --version
docker compose version
```

Node should report `v22.x`. If the commands are not recognized, reopen VS Code after installing the tools.

## 3. Install the JavaScript dependencies

```sh
npm ci
```

This installs the versions recorded in `package-lock.json`. If your export does not include that lockfile, use `npm install` instead.

## 4. Create local environment settings

> **If `.env` already exists:** the helper below will not overwrite it. Some workspace exports include preview settings. For a new, independent local database, rename that preview-only file to `.env.preview-backup` in VS Code, then run the helper. Do not rename or replace an environment file belonging to a database you need to keep. Environment backups are also excluded from Git.

```sh
node scripts/setup-local.mjs
```

On a fresh copy, this creates `.env` from `.env.example` with:

- `POSTGRES_USER`, `POSTGRES_DB`, and `POSTGRES_PORT`: local database settings.
- `POSTGRES_PASSWORD`: a randomly generated local PostgreSQL password.
- `DATABASE_URL`: the matching database connection URL, used by the app, Drizzle Kit, and seed script.
- `JWT_SECRET`: a separate, randomly generated JWT signing secret.

No secret values are printed. Keep `.env` private. Never prefix database credentials or `JWT_SECRET` with `NEXT_PUBLIC_`, because that prefix exposes values to browser code.

If you keep an existing `.env`, ensure these settings are present and consistent before proceeding. You can generate a new JWT secret for a fresh local setup with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste that output into `JWT_SECRET` in your private `.env`. Rotating a JWT secret invalidates existing login sessions.

## 5. Start PostgreSQL

```sh
docker compose up -d --wait
```

The included `compose.yaml` starts **PostgreSQL 17**, creates `app_db`, and waits for database readiness. Only the database runs in Docker; the Next.js app runs directly in your terminal. PostgreSQL is bound to `127.0.0.1`, not exposed to your network.

Check its state if needed:

```sh
docker compose ps
docker compose logs db
```

If port 5432 is already occupied, either use your existing PostgreSQL installation or choose another port, such as 5433. For the Docker option, update **both** `POSTGRES_PORT` and the port in `DATABASE_URL` before starting it.

## 6. Create the tables and demo accounts

Run in this order:

```sh
npx drizzle-kit push
npx tsx scripts/seed.ts
```

- `drizzle-kit push` reads `src/db/schema.ts` and creates the database tables, enums, and constraints. The new `drizzle.config.ts` reads `DATABASE_URL` from `.env`; it does not assume the preview database address.
- `scripts/seed.ts` creates example departments, designations, leave types, holidays, and an account/profile for each role.
- The seed script skips matching existing records; it **does not reset existing account passwords**.

Use `push` for a disposable local/development database. Review its prompts; do not accept destructive changes against a database containing important data. Production schema changes should use reviewed, versioned migrations and backups instead.

A fresh local database is **separate from the hosted preview**. Records added in the preview and runtime-uploaded files do not automatically transfer. The seed supplies baseline demo data, not a copy of all preview data.

## 7. Start the application

```sh
npm run dev
```

Leave this terminal running, then open:

- **Login:** http://localhost:3000/login
- **Database connectivity check:** http://localhost:3000/api/health

The health response should contain `"ok": true`. This checks the database connection; signing in also confirms the tables and demo users were created.

Use the port printed by Next.js if it chooses a different one. Do not use VS Code's **Live Server** extension for this app; it cannot run Next.js APIs or database code.

### HR demo logins

All seeded accounts initially use **`Password@123`**:

| Role | Email |
| --- | --- |
| HR Admin | `hradmin@ems.local` |
| HR Executive / HR | `hrexec@ems.local` |
| Super Admin | `superadmin@ems.local` |
| Employee | `employee@ems.local` |
| Department Manager | `manager@ems.local` |
| Team Lead | `teamlead@ems.local` |
| Finance Admin | `finance@ems.local` |
| Training Admin | `trainingadmin@ems.local` |
| Trainer | `trainer@ems.local` |
| Auditor | `auditor@ems.local` |

The displayed **minimum 6 characters** is a validation rule, not the demo password. It does not mean that any six-character string will sign in. Never expose these known demo credentials in a real deployment.

## Daily startup and shutdown

After the first successful setup, you normally only need:

```sh
docker compose up -d --wait
npm run dev
```

You do not need to reinstall packages, push the schema, or rerun the seed every day. Restart `npm run dev` after editing `.env`.

- Stop Next.js with **Ctrl+C** in its terminal.
- Stop the local database with `docker compose stop db`.
- Database data is stored in the named Docker volume and survives ordinary container stops/removal.
- **Do not run `docker compose down -v` unless you intentionally want to delete this local database.** Back up important data first.
- PostgreSQL's initialization settings only create credentials on a new volume. Changing `POSTGRES_PASSWORD` in `.env` later does not change a password inside an already-initialized database.

## Alternative: native PostgreSQL, without Docker

1. Install PostgreSQL 17, or use an existing compatible PostgreSQL service. Start that service.
2. Create an empty database named **`app_db`** owned by your local database user, using pgAdmin or your preferred database administration tool.
3. Create `.env` with the helper above, or copy `.env.example` to `.env`.
4. Set `DATABASE_URL` to your actual connection string in the format below. Replace the placeholders; do not use them literally:

```text
postgresql://YOUR_USER:URL_ENCODED_PASSWORD@127.0.0.1:5432/app_db
```

5. Set `JWT_SECRET` to a freshly generated secret if it is missing. The helper already generates one when creating a new `.env`.
6. Skip all Docker commands; run the dependency install, Drizzle push, seed, and `npm run dev` steps above.

The `POSTGRES_*` settings are only used by Docker Compose. The application and Drizzle use **`DATABASE_URL`**. Passwords containing special URL characters such as `@`, `:`, `/`, or `#` must be percent-encoded in that URL. Hosted providers may require TLS connection options supplied by the provider.

## Debugging in VS Code

A `.vscode/launch.json` is included:

1. Finish database setup first.
2. Stop a previously started `npm run dev` server to avoid duplicate servers/port conflicts.
3. Open **Run and Debug**, choose **VolkssKatt: debug Next.js**, and press **F5**.
4. Add a breakpoint in a route such as `src/app/api/auth/login/route.ts`, then sign in from the browser.
5. For React/browser breakpoints, leave the app running and launch **VolkssKatt: debug browser (Chrome)**. This optional profile requires Google Chrome; update its URL if your dev server is using another port.

## Useful project locations

| Location | Purpose |
| --- | --- |
| `src/app/(app)/` | Dashboard and employee/training module pages |
| `src/app/login/page.tsx` | Login interface |
| `src/app/api/` | REST route handlers (backend) |
| `src/db/schema.ts` | PostgreSQL table definitions |
| `src/db/index.ts` | Drizzle database connection |
| `src/lib/rbac.ts` | Role helper functions |
| `src/lib/password.ts` | Minimum password length and messages |
| `src/components/` | Shared UI, sidebar, and company logo component |
| `src/app/globals.css` | VolkssKatt brand colors/gradients |
| `public/images/` | Company logo assets |
| `.env` | Private machine-specific configuration |
| `scripts/seed.ts` | Development/demo data |

## Troubleshooting

| Problem | What it means / how to resolve it |
| --- | --- |
| `npm` or `node` is not recognized | Install Node 22 and reopen VS Code so it picks up the updated PATH. |
| PowerShell says `npm.ps1` cannot be loaded | Use **Terminal → Select Default Profile → Command Prompt**, then open a new terminal; alternatively use `npm.cmd` and `npx.cmd`. You do not need to weaken machine-wide execution policy. |
| Docker cannot connect to its daemon | Open Docker Desktop and wait until its engine is running. |
| `POSTGRES_PASSWORD` is required by Compose | Run the helper on a fresh local copy, or configure the existing `.env` so the Compose password and `DATABASE_URL` match. |
| `DATABASE_URL is missing` | Create a `.env` in the folder containing `package.json`; make sure the value is not blank. Restart Next.js after editing it. |
| `ECONNREFUSED` at port 5432 | PostgreSQL is stopped, or the host/port in `DATABASE_URL` is incorrect. Check the database service or `docker compose ps`. |
| `password authentication failed` | The credentials in `DATABASE_URL` do not match the running database. Editing a Compose password does not reset an existing database volume's credentials. |
| `database app_db does not exist` | Create the database in your native PostgreSQL instance, or confirm that Compose initialized the intended volume/database. |
| `relation users does not exist` | The schema has not been applied to this database. Run `npx drizzle-kit push` before the seed. |
| Demo sign-in fails | Run `npx tsx scripts/seed.ts`, check the exact email/password above, and make sure the app and seed use the same `DATABASE_URL`. Existing changed passwords are not reset by seeding. |
| Port 3000 is in use | Stop the other app, or run `npm run dev -- --port 3001` and visit the URL it prints. |
| Changes to `.env` have no effect | Stop and restart the dev server. Avoid conflicting `.env.local` values or shell-level environment overrides. |

## Checks before committing

```sh
node --test scripts/setup-local.test.mjs
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

The setup tests use temporary directories and do not change your real `.env`. These checks validate setup behavior and compilation, not the entire application's business logic or production security.

Keep `package-lock.json` in version control. The included `.gitignore` excludes dependencies, build output, `.env` files/backups, and runtime employee-document uploads.

Before using real employee data, conduct a separate security and deployment review: demo-account removal, session/role enforcement, private document delivery, payroll rules, backups, persistent upload storage, TLS, and reviewed migrations all need attention. This local setup guide does not certify production readiness.
