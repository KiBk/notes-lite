# Notes Lite

Notes Lite is a lightweight Google Keep–style experience for quick capture, sorting, and revisiting colour-tinted notes. Sessions, themes, and note data all persist locally per signed-in user.

## Features
- Name-only sign-in with a theme toggle that respects system defaults and stores the most recent session.
- Masonry-style grid that groups pinned cards above the rest, complete with hover pin affordances and soft gradient fades for long bodies.
- Colour-aware sheet editor with blurred backdrop, auto-resizing textarea, and action chips for colour, pinning, archiving, and permanent deletion.
- Instant search across active and archived notes; results list active cards first, with archived matches following.
- Drag-and-drop reordering within pinned, unpinned, and archived buckets—orders persist immediately per user.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   The app is served at the URL printed in the terminal.
3. Build for production:
   ```bash
   npm run build
   ```
4. Preview the production build locally (after running the build step):
   ```bash
   npm run preview
   ```

## Tech Stack
- React 18 + TypeScript
- Vite build tooling
- [@dnd-kit](https://github.com/clauderic/dnd-kit) for drag-and-drop ordering

> **Data storage**: All notes, theme selections, and session info live in `localStorage`. Clearing browser storage resets the app.
