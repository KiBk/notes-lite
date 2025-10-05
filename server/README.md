# Notes Service

A compact Node.js + SQLite backend that mirrors the frontend store contract and exposes CRUD endpoints for notes. Authentication is expected to be handled upstream (e.g. reverse proxy / OpenID), so every request is keyed by the logical `userId` path parameter.

## Runtime summary
- **Framework:** Express 4.x
- **Database:** SQLite (file-based)
- **Light validation:** All payloads are validated with `zod` before hitting the database. Pinned and archived flags are mutually exclusive.
- **Automated migrations:** SQL files inside `server/migrations` are applied on startup (and via `npm run migrate`) using a tiny built-in runner.
- **State contract:** Every mutating endpoint returns a `UserStore` JSON object that matches the frontend shape in `app/src/types.ts`.

## Core tables
- `users` – canonical list of user ids seen by the service; timestamps make it trivial to audit activity.
- `notes` – stores note fields (`title`, `body`, `color`, `pinned`, `archived`, timestamps) keyed by `id` and `user_id`.
- `note_orders` – tracks display order per user + bucket (`pinned`, `unpinned`, `archived`) to support drag-and-drop. `position` is always a dense 0..N sequence.

## API
| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/healthz` | Liveness check. |
| `GET` | `/api/users/:userId/store` | Returns the full `UserStore` payload (`notes`, `pinnedOrder`, `unpinnedOrder`, `archivedOrder`). |
| `POST` | `/api/users/:userId/notes` | Creates a note from an optional payload (`title`, `body`, `color`, `pinned`, `archived`) and returns the updated store. |
| `PATCH` | `/api/users/:userId/notes/:noteId` | Applies partial updates (same fields as create) and returns the updated store. |
| `DELETE` | `/api/users/:userId/notes/:noteId` | Removes the note and returns the updated store. |
| `PUT` | `/api/users/:userId/orders/:bucket` | Persists a full re-ordered array for one bucket (`pinned`, `unpinned`, `archived`). |

### Payload notes
- `color` must be a 6-digit hex string (e.g. `#fde2e4`).
- `title` ≤ 512 chars, `body` ≤ 5000 chars.
- `pinned` and `archived` cannot both be `true`.
- `order` payload for reordering must include exactly the IDs currently in the bucket.

## Local development
```bash
cd server
npm install
npm run migrate   # applies migrations to ./data/notes.db
npm run dev       # starts the service on http://localhost:4000
```

The service writes to `data/notes.db` by default. Override with `DATABASE_PATH` if you prefer a different location.
`better-sqlite3` provides a native binding; if Node reports missing binaries, run `npm rebuild better-sqlite3 --build-from-source` (requires make/gcc and python3).

## Docker / Compose
A multi-stage Dockerfile is provided. The default command runs migrations on startup and then serves HTTP.

```bash
# Build & run only the backend
docker compose up notes-service --build
```

Volume `notes_data` persists the SQLite file in `./data/notes.db`. Attach the frontend (or reverse proxy) to the same compose project and point it at `http://notes-service:4000/api`.
