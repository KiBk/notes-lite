const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (err) {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return response.json();
}

export async function login(name) {
  return request('/api/session', {
    method: 'POST',
    body: { name },
  });
}

export async function fetchNotes(userId, search) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (search && search.trim()) {
    params.set('search', search.trim());
  }
  return request(`/api/notes?${params.toString()}`);
}

export async function createNote(userId, note) {
  return request('/api/notes', {
    method: 'POST',
    body: { userId, ...note },
  });
}

export async function updateNote(userId, noteId, updates) {
  return request(`/api/notes/${noteId}`, {
    method: 'PATCH',
    body: { userId, ...updates },
  });
}

export async function deleteNote(userId, noteId) {
  const params = new URLSearchParams({ userId: String(userId) });
  return request(`/api/notes/${noteId}?${params.toString()}`, {
    method: 'DELETE',
  });
}

export async function reorderNotes(userId, { pinnedIds, unpinnedIds, archivedIds }) {
  return request('/api/notes/reorder', {
    method: 'POST',
    body: { userId, pinnedIds, unpinnedIds, archivedIds },
  });
}
