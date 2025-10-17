# Notes Lite Overview

A lightweight, Google Keep–style notes app that supports quick capture, editing, and organization across multiple devices.

## Key Workflows
- **Sign-in** – A name-only login screen with a theme toggle (light/dark). Remembers the last name entered and pre-fills it on return, but requires the user to sign in again after refresh.
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
- **Theme aware** – Provide a persistent light/dark theme toggle accessible from both the login screen and top bar. Persist the chosen theme in local storage and respect system defaults; switching themes remaps every note colour between the light and dark palettes.
- **Session aware** – Each user’s notes remain separate. Theme choice and last-used name persist locally, but refreshing the page returns you to the sign-in screen.

## Implementation
- Sign-in flow (`LoginScreen.tsx`, `store.tsx`): simple name capture with theme toggle, remembering the most recent name in local storage so it’s pre-filled on the next visit.
- Floating note creation (`Fab.tsx`, `store.tsx`): a fixed action button seeds theme-appropriate pastel notes and saves them immediately per user.
- Masonry board (`NotesGrid.tsx`, `App.css`): CSS grid variables plus `ResizeObserver`-driven row spans maintain tight packing with uniform gutters across cards.
- Card editing sheet (`NoteSheet.tsx`, `App.css`): near full-height modal inherits the note colour, keeps the grid blurred behind, and offers auto-growing text with anchored action chips.
- Colour palette (`ColorPalette.tsx`): floating bubble palette keeps focus inside while picking swatches, then updates the note hue instantly.
- Pinning & sections (`NoteCard.tsx`, `store.tsx`): lightweight pin control surfaces on hover and maintains separate pinned/unpinned orders.
- Archive management (`App.tsx`, `NoteSheet.tsx`): archived notes live behind a dedicated tab with delete-forever handling.
- Global search (`TopBar.tsx`, `App.tsx`): filters across active and archived notes, grouping results for clarity.
- Drag-and-drop ordering (`NotesGrid.tsx`, `@dnd-kit`): pointer/touch sensors feed reordering callbacks that persist the new sequence.
- Theme-aware cards (`NoteCard.tsx`, `App.css`): note preview fades sample the card colour, adjusting opacity per theme so long text blends smoothly.
- Theming (`ThemeToggle.tsx`, `store.tsx`): light/dark selection stored alongside the user profile; switching modes remaps note colours between the paired light/dark palettes while new notes pick the current palette’s defaults.
- Session persistence (`store.tsx`): serialized state keeps users, note collections, and preferences intact across refreshes.
