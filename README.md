# Amani Eye — Optometry Practice Manager

Full-stack practice management system: React frontend, Node HTTP API, SQLite database.

```
frontend/   React + TanStack Start UI (Vite)
backend/    Node API server (node:http + node:sqlite), seeding, analytics
db/         schema.sql and the generated practice.db SQLite file
```

This project was built with [Lovable](https://lovable.dev) and can still be edited in the
[Lovable editor](https://lovable.dev/projects/f176822e-5ae4-447a-b8c1-f5a6b8bf52d1).

## Requirements

- Node.js >= 24 (the backend uses the built-in `node:sqlite` module and runs TypeScript directly)
- npm or bun for the frontend

## Running the system

Backend (port 4000) — creates and seeds `db/practice.db` on first start:

```sh
cd backend && npm start
```

Frontend (port 8080):

```sh
cd frontend && npm install && npm run dev
```

Open http://localhost:8080 and sign in.

| Account | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `1234` |
| Demo staff (e.g. `jkariuki`) | see Users page | `demo1234` |

## Configuration

| Variable | Where | Default |
| --- | --- | --- |
| `PORT` | backend | `4000` |
| `DATABASE_FILE` | backend | `db/practice.db` |
| `FRONTEND_ORIGIN` | backend (CORS) | `*` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | backend seed | `admin` / `1234` |
| `VITE_API_URL` | frontend | `http://localhost:4000` |

## Database

`db/schema.sql` holds the full relational schema and is applied on every backend start.
To wipe and reseed:

```sh
cd backend && npm run reset
```
