# Notes Lite

A lightweight, Google Keep–style notes app that lets you capture, pin, archive, and reorder notes quickly. The project ships with a React frontend, an Express/PostgreSQL backend, automated tests, and Docker tooling for a consistent multi-service setup.

## Features
- Name-based sign-in that remembers the most recent session locally.
- Create, edit, pin/unpin, archive/unarchive, permanently delete notes, personalise note colour, and switch themes with a dark mode toggle.
- Responsive masonry-inspired layout with dedicated pinned and unpinned sections.
- Global search that surfaces active results first, followed by archived matches.
- Drag-and-drop reordering for pinned, unpinned, and archived notes (keyboard accessible).
- Modal editing experience with keyboard shortcuts (Enter/Space to open, Escape to close).
- Data separation per user with automatic session restoration on refresh.

## Project Structure
```
backend/   # Express API, PostgreSQL schema, Jest tests
frontend/  # React app (Vite), Vitest/Testing Library specs
```

## Prerequisites
- Node.js 20+
- PostgreSQL 16+ (for local backend tests)
- npm 10+

## Local Development
### Backend API
```bash
cd backend
cp .env.example .env            # adjust if needed
npm install
npm run dev                     # starts on http://localhost:4000
```
The server runs migrations on startup. Set `DATABASE_URL` in `.env` if you are not using the defaults.

### Frontend
```bash
cd frontend
cp .env.example .env            # defaults to http://localhost:4000
npm install
npm run dev -- --host          # serves on http://localhost:5173
```

## Running Tests
### Backend
The backend integration tests require PostgreSQL. You can start the database from Docker Compose first (`docker compose up db -d`). Then run:
```bash
cd backend
DATABASE_URL=postgres://postgres:postgres@localhost:5432/noteslite_test npm test
```

### Frontend
```bash
cd frontend
npm run test
```

## Docker
Build and run the complete stack (frontend, backend, PostgreSQL):
```bash
docker compose up --build
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- PostgreSQL: exposed on port 5432

## Continuous Integration
GitHub Actions (`.github/workflows/ci.yml`) installs dependencies, spins up PostgreSQL, runs backend and frontend tests, builds the frontend bundle, and verifies the Docker images build successfully.

## Accessibility & Keyboard Support
- Cards are focusable; press Enter or Space to open the editing modal.
- Escape closes the modal.
- Drag-and-drop controls include focus and keyboard guidance from the DnD library.

## Environment Variables
- Backend: `DATABASE_URL`, `PORT`
- Frontend: `VITE_API_URL`

Environment samples live in `backend/.env.example` and `frontend/.env.example`.
