# Flowboard

A full-stack task management app inspired by Asana: workspaces, teams, projects,
tasks with subtasks, list/board/calendar views, comments, activity history, and
real-time notifications.

## Stack

- **Client:** React 18 + Vite + TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand, `@dnd-kit` (drag-and-drop board), Socket.IO client
- **Server:** Node + Express + TypeScript, Prisma ORM, PostgreSQL, JWT auth (access + httpOnly refresh cookie), Socket.IO
- **Monorepo:** npm workspaces (`server/`, `client/`)

## Features

- Email/password auth with short-lived access tokens + rotating refresh cookie
- "Sign in / up with Google" (optional — the app works fine without it, see setup below)
- Workspaces → Teams → Projects → Tasks/Subtasks hierarchy
- List view, Kanban board view (drag-and-drop between sections), Calendar view
- Task detail panel: assignee, due date, priority, tags, description, subtasks, comments, activity log
- "My Tasks" cross-project view (overdue / today / upcoming)
- Real-time updates over WebSockets: live task changes, new comments, and notifications
- Notification center (assignments, comments, completions, project invites)
- Workspace member invites, team membership management, project sharing

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ — either via Docker, or a local install (e.g. `brew install postgresql@16` on macOS)

## Setup

### 1. Install dependencies

```bash
npm install
```

This installs both `server/` and `client/` (npm workspaces).

### 2. Start PostgreSQL

**Option A — Docker (recommended if you have Docker installed):**

```bash
npm run db:up   # docker compose up -d, uses docker-compose.yml
```

**Option B — a local PostgreSQL install:**

Create a database and user matching `server/.env` (see step 3), e.g.:

```bash
psql -d postgres -c "CREATE USER taskuser WITH PASSWORD 'taskpass' CREATEDB;"
psql -d postgres -c "CREATE DATABASE taskmanagement OWNER taskuser;"
```

### 3. Configure environment variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env` if your database credentials differ, and replace the
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` placeholders with real random
strings before you deploy this anywhere beyond your own machine.

The client reads `client/.env` (already set to `VITE_API_URL=http://localhost:4000`).

### 4. (Optional) Enable "Sign in with Google"

Email/password auth works out of the box with no extra setup. To also enable
the Google button on the login/signup pages:

1. Go to the [Google Cloud Console credentials page](https://console.cloud.google.com/apis/credentials)
   (create a project first if you don't have one).
2. Create an **OAuth client ID** → application type **Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost:5173`.
   (You don't need a redirect URI — this app uses Google's token-based
   Sign-In-With-Google flow, not a redirect flow.)
4. Copy the generated **Client ID** into both:
   - `server/.env` → `GOOGLE_CLIENT_ID="<client-id>"`
   - `client/.env` → `VITE_GOOGLE_CLIENT_ID=<client-id>` (same value — Client IDs are public, not secret)
5. Restart the app.

If you skip this, the Google button simply doesn't render and email/password
auth keeps working normally. The first time someone signs in with Google, an
account is created (or linked to an existing password account with the same
email) and given a personal workspace, same as a normal signup.

### 5. Run migrations and seed demo data

```bash
npm run prisma:migrate   # creates tables
npm run prisma:seed      # demo workspace, team, project, tasks, comments
```

### 6. Start the app

Either:

```bash
npm run dev
```

which runs both the API (port 4000) and the client (port 5173) concurrently
in the foreground (Ctrl-C stops both), or use the background scripts:

```bash
./scripts/start.sh   # starts Postgres (if needed) + server + client in the background
./scripts/stop.sh    # stops server + client, leaves Postgres running
./scripts/stop.sh --with-db   # also stops Postgres
```

`start.sh` is safe to re-run — it won't double-start anything already up, and
it'll create `server/.env` from the example file automatically on first run.
Logs go to `logs/server.log` and `logs/client.log`; PIDs are tracked in `.run/`.

Either way, open **http://localhost:5173**.

### Demo accounts

All seeded with password `password123`:

| Email | Role |
|---|---|
| alice@example.com | Workspace owner |
| bob@example.com | Workspace admin |
| carol@example.com | Member |
| dave@example.com | Member |

## Project structure

```
server/
  prisma/schema.prisma   # data model: users, workspaces, teams, projects,
                         # sections, tasks, comments, activity, notifications, tags
  prisma/seed.ts         # demo data
  src/
    routes/              # REST endpoints, one file per resource
    middleware/           auth.ts (JWT), access.ts (workspace/project/task scoping)
    services/             notification.service.ts, activity.service.ts
    sockets/               Socket.IO rooms (per-user, per-project)
client/
  src/
    api/                 axios client + TanStack Query hooks per resource
    store/                zustand: auth session, task-detail-panel open state
    hooks/useSocket.ts     realtime connection + per-project room join
    components/
      layout/              Sidebar, Topbar, notifications dropdown
      project/              List view, Kanban board (dnd-kit)
      calendar/              Month-grid calendar view
      task/                  Task detail slide-over panel
    pages/                one component per route
```

## Useful scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Run server + client together |
| `npm run dev:server` / `npm run dev:client` | Run just one side |
| `npm run build` | Production build of both |
| `npm run prisma:studio` | Open Prisma Studio (DB browser) |
| `npm run prisma:migrate` | Apply schema migrations |

## Notes on scope / next steps

This covers the core Asana-like workflow end-to-end. Reasonable next additions:
file attachments, task dependencies, per-project custom fields, saved
filters/search, and an email digest for notifications. The auth model
supports adding OAuth providers alongside password login without schema
changes (the `User` model just needs an optional password hash).
