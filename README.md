# Notes Lite

A lightweight notes app inspired by Google Keep. A vanilla JS frontend talks to an Express API backed by PostgreSQL for per-user note storage.

## Quick start

```sh
docker compose build
docker compose up
```

Open http://localhost:8080 for the web app. The API is reachable at http://localhost:5000 and is proxied through the frontend container under `/api/*`.

Data lives in the bundled PostgreSQL container. A named volume (`db-data`) keeps your notes between restarts.

## Frontend (`frontend/`)

- Pure HTML/CSS/JS
- Loads notes after logging in and edits them through a modal overlay
- All API calls go to relative `/api/*` paths (proxied by nginx in Docker)

## Backend (`backend/`)

- Express server with cookie-based sessions and optional OpenID Connect SSO
- PostgreSQL persistence via `DATABASE_URL`
- Endpoints
  - `POST /api/session` — log in / create user
  - `GET /api/session` — fetch active session
  - `POST /api/logout` — clear session cookie
  - `GET /api/notes` — list notes for the logged-in user
  - `POST /api/notes` — create a note
  - `PUT /api/notes/:id` — update an existing note

Run the API locally (without Docker):

```sh
npm install --prefix backend
DATABASE_URL=postgres://user:pass@127.0.0.1:5432/notes npm start --prefix backend
```

You can then serve the frontend separately (e.g. `npx http-server frontend --proxy http://127.0.0.1:5000?`) so `/api` requests reach the backend.

## Tests

Backend API tests run outside Docker with an in-memory stub database:

```sh
npm install --prefix backend
npm test --prefix backend
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same commands on pushes and pull requests.

## Authentication

- **OpenID Connect** – Set the following environment variables (via `.env` consumed by `docker compose`, or directly when running the backend) to delegate authentication to your identity provider (e.g. Authelia):
  - `OIDC_ISSUER`
  - `OIDC_CLIENT_ID`
  - `OIDC_CLIENT_SECRET` (optional for public clients)
  - `OIDC_CALLBACK_URL` (defaults to `http://localhost:5000/api/auth/oidc/callback` in Docker)
  - `OIDC_SCOPE` (defaults to `openid profile email`)
- **Dev bypass** – `ENABLE_DEV_LOGIN` defaults to `true` for local work. Set it to `false` when you want to require SSO. `DEV_AUTO_LOGIN_USERNAME` (defaults to `admin` when dev login is enabled) pre-populates a session for local development.
- When OIDC is active, the frontend shows a “Continue with Single Sign-On” button and hides the manual login form if dev login is disabled.

## Next steps

- Add note deletion, pinning, and search
- Support tagging or quick filters
- Introduce database migrations (e.g. via Prisma or Knex)
- Add tests (API unit tests + E2E UI flow)
