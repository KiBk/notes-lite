# Notes Lite Overview

A lightweight, Google Keep–style notes app that supports quick capture, editing, and organization across multiple devices.

## Key Workflows
- **Sign-in** – A name-only login screen with a theme toggle (light/dark). Persist the last signed-in user and restore their session automatically.
- **Create notes** – A fixed floating action button creates a new note seeded with the theme’s default pastel colour. Notes contain a title, body, colour swatch, and metadata, and save immediately for the active user.
- **Read at a glance** – Notes render in a masonry-style grid with consistent gutters. Card heights auto-adjust; long bodies fade out with a gradient sampled from the card colour.
- **Edit with context** – Clicking a card opens a colour-tinted sheet modal. The sheet sits on a blurred overlay, matches the current note colour, auto-grows the body textarea, and closes on Escape or backdrop click. The sheet footer hosts action chips (Colour, Pin/Unpin, Archive/Unarchive, Delete forever when applicable) using minimal glyphs (`○`/`●`) instead of emojis.
- **Colour control** – Tapping the “Colour” chip reveals a floating palette bubble elevated above the sheet. The palette offers seven muted pastel options; it hides when the pointer leaves or focus shifts away, and selecting a colour updates both the card and sheet instantly.

## Organizing Notes
- **Pinned section** – Hover/focus reveals a minimalist pin control on each card. Pinned notes gather in a dedicated grid above other notes while keeping consistent spacing.
- **Active vs. Archived** – Two tabs (“Notes”, “Archived”) swap between active and stored-away content. Archive/unarchive actions live in the sheet footer chips; archived notes expose a “Delete forever” chip.
- **Search everywhere** – A top search bar filters across all notes (active and archived). Results show active matches first, followed by archived ones.
- **Drag-and-drop ordering** – Reorder notes simply by dragging cards. Active notes let you rearrange within pinned and unpinned sections; archived notes have their own order. The new sequence is saved immediately.

## Additional Touches
- **Visual polish** – Use blurred sheet overlays, subtle shadows, softened borders, and auto-expanding text areas to keep the UI modern. Keep action chips horizontally aligned.
- **Theme aware** – Provide a persistent light/dark theme toggle accessible from both the login screen and top bar. Persist the chosen theme in local storage and respect system defaults.
- **Session aware** – Each user’s notes remain separate, and switching tabs or refreshing keeps the current session. Persist both user and theme preferences locally.
