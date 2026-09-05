# Editorial Workflow

Starter scaffold. Two apps:

- `server/` — Express + TypeScript + Prisma API
- `client/` — React + Vite + TypeScript frontend

## Getting started

```bash
# 1. Database (do this first — everything else needs DATABASE_URL)
#    Create a free Postgres instance (e.g. Supabase), copy the connection string.

# 2. Server
cd server
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev                # http://localhost:4000

# 3. Client
cd ../client
cp .env.example .env       # fill in VITE_API_URL=http://localhost:4000
npm install
npm run dev                # http://localhost:5173
```

## What's here vs. what you build

This scaffold gives you: project structure, the Prisma schema (all 6 tables from the
brief), a working auth flow (signup/login/logout/JWT middleware/role middleware), a seed
script with demo data, and an empty React app wired to call the API. Everything else —
sections, the article state machine, search/bulk/CSV, dashboard, timeline, alerts, and
all the frontend screens — is intentionally not built yet. Build it session by session
per your plan.md, committing as you go.

See the top-level assignment README.md (from your take-home zip) for the full spec.
