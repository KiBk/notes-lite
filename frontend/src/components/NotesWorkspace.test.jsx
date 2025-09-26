import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NotesWorkspace } from './NotesWorkspace.jsx';
import { DEFAULT_NOTE_COLOR, NOTE_COLORS } from '../constants/noteColors.js';
import {
  fetchNotes,
  updateNote,
  reorderNotes,
} from '../api.js';

vi.mock('../api.js', () => ({
  fetchNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  reorderNotes: vi.fn(),
  login: vi.fn(),
}));

const baseUser = { id: 1, name: 'Alex' };
const emptyNotes = { notes: { pinned: [], unpinned: [], archived: [] } };

beforeEach(() => {
  fetchNotes.mockImplementation(() => Promise.resolve(emptyNotes));
  updateNote.mockResolvedValue({ note: { id: 1, title: '', body: '', pinned: false, archived: false } });
  reorderNotes.mockResolvedValue(emptyNotes);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('NotesWorkspace', () => {
  test('renders pinned and other sections when notes load', async () => {
    fetchNotes.mockImplementation(() =>
      Promise.resolve({
        notes: {
          pinned: [
            {
              id: 10,
              title: 'Pinned',
              body: 'star',
              pinned: true,
              archived: false,
              color: NOTE_COLORS[1],
            },
          ],
          unpinned: [
            {
              id: 11,
              title: 'Regular',
              body: '',
              pinned: false,
              archived: false,
              color: DEFAULT_NOTE_COLOR,
            },
          ],
          archived: [],
        },
      })
    );

    render(<NotesWorkspace user={baseUser} onLogout={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Pinned' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Others' })).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  test('search results show active before archived', async () => {
    fetchNotes.mockImplementation((_userId, searchTerm) => {
      if (searchTerm) {
        return Promise.resolve({
          notes: {
            pinned: [],
            unpinned: [
              {
                id: 1,
                title: 'Project plan',
                body: '',
                pinned: false,
                archived: false,
                color: NOTE_COLORS[2],
              },
            ],
            archived: [
              {
                id: 2,
                title: 'Archived doc',
                body: '',
                pinned: false,
                archived: true,
                color: NOTE_COLORS[3],
              },
            ],
          },
        });
      }
      return Promise.resolve(emptyNotes);
    });

    const user = userEvent.setup();
    render(<NotesWorkspace user={baseUser} onLogout={vi.fn()} />);

    const searchBox = await screen.findByPlaceholderText('Search notes');
    await user.type(searchBox, 'project');

    await waitFor(() => screen.getByText('Active results'));

    expect(screen.getByText('Active results')).toBeInTheDocument();
    expect(screen.getByText('Project plan')).toBeInTheDocument();
    expect(screen.getByText('Archived results')).toBeInTheDocument();
    expect(screen.getByText('Archived doc')).toBeInTheDocument();
  });

  test('switch user button triggers logout', async () => {
    fetchNotes.mockResolvedValueOnce(emptyNotes);
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(<NotesWorkspace user={baseUser} onLogout={onLogout} />);

    await waitFor(() => expect(fetchNotes).toHaveBeenCalled());

    const button = screen.getByRole('button', { name: /switch user/i });
    await user.click(button);
    expect(onLogout).toHaveBeenCalled();
  });
});
