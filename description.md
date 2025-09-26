# Notes Lite Overview

A lightweight, Google Keep–style notes app that supports quick capture, editing, and organization across multiple devices.

## Key Workflows
- **Sign-in** – Start with a simple name-based login for quick access, or authenticate through an OpenID Connect provider (e.g., Authelia). The app remembers the last user session and restores it automatically.
- **Create notes** – Use the plus button to add a new note consisting of a plain-text title and body. Notes save immediately to the user’s account.
- **Read at a glance** – Notes appear in a responsive masonry layout. Long notes show a preview with a fade-out so cards stay compact; open the note to read everything.
- **Edit in place** – Click a note to open a modal where you can update the title or body. Changes persist when you save.

## Organizing Notes
- **Pinned section** – Pin important notes directly from the card hover control; pinned notes collect in a dedicated row at the top of the active view. Unpinning is just as easy.
- **Active vs. Archived** – The interface has two tabs: “Notes” for active items and “Archived” for stored-away notes. Archiving moves a note out of the active view without deleting it. From the modal you can archive (or delete forever if already archived) and unarchive notes back to the active list.
- **Search everywhere** – A top search bar filters across all notes (active and archived). Results show active matches first, followed by archived ones.
- **Drag-and-drop ordering** – Reorder notes simply by dragging cards. Active notes let you rearrange within pinned and unpinned sections; archived notes have their own order. The new sequence is saved immediately.

## Additional Touches
- **Keyboard friendly** – Cards are focusable and can be opened with Enter or Space; Escape closes the edit modal.
- **Session aware** – Each user’s notes remain separate, and switching tabs or refreshing keeps the current session.
- **Docker ready** – The project runs as a multi-container stack (frontend, backend, PostgreSQL) so it can be deployed consistently.

Use this description as the product spec: a developer should be able to recreate the experience by implementing the flows and behaviors outlined above.
