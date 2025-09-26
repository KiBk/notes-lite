const dom = {
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  loginSubtitle: document.querySelector(".login__subtitle"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  usernameInput: document.getElementById("usernameInput"),
  app: document.querySelector(".app"),
  notesContainer: document.getElementById("notesContainer"),
  addNoteButton: document.getElementById("addNoteButton"),
  modal: document.getElementById("noteModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  closeModalButton: document.getElementById("closeModalButton"),
  noteForm: document.getElementById("noteForm"),
  modalTitle: document.getElementById("modalTitle"),
  noteTitleInput: document.getElementById("noteTitleInput"),
  noteBodyInput: document.getElementById("noteBodyInput"),
  oidcButton: document.getElementById("oidcLoginButton"),
  deleteButton: document.getElementById("deleteNoteButton"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
};

const state = {
  currentUser: null,
  notes: [],
  editing: null,
  searchTerm: "",
  view: "active",
};

const authConfig = {
  mode: "local",
  loginUrl: null,
  devLoginAllowed: true,
};

dom.loginForm.addEventListener("submit", handleLogin);
dom.addNoteButton.addEventListener("click", () => {
  openModal({
    mode: "new",
    note: { id: null, title: "", body: "", archived: false },
  });
});

dom.closeModalButton.addEventListener("click", closeModal);
dom.modalBackdrop.addEventListener("click", closeModal);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.editing) {
    closeModal();
  }
});

dom.noteForm.addEventListener("submit", handleNoteSubmit);
dom.oidcButton?.addEventListener("click", handleOidcLogin);
dom.searchForm?.addEventListener("submit", handleSearchSubmit);
dom.deleteButton?.addEventListener("click", handleDeleteNote);
dom.viewTabs?.forEach((button) => {
  button.addEventListener("click", handleViewChange);
});

async function handleViewChange(event) {
  const button = event.currentTarget;
  if (!button || !button.dataset.view) {
    return;
  }

  const nextView = button.dataset.view;
  if (!nextView) {
    return;
  }

  if (state.view !== nextView || state.searchTerm) {
    state.view = nextView;
    state.searchTerm = "";
    if (dom.searchInput) {
      dom.searchInput.value = "";
    }
    await loadNotes("", nextView);
  }
}

function updateViewControls() {
  if (!dom.viewTabs) {
    return;
  }
  dom.viewTabs.forEach((button) => {
    const view = button.dataset.view;
    const isActive = state.view === view;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

async function loadAuthConfig() {
  try {
    const response = await fetch("/api/auth/config", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Failed to load auth config");
    }
    const data = await response.json();
    mergeAuthConfig(data);
  } catch (error) {
    console.error(error);
    applyAuthConfigUi();
  }
}

function mergeAuthConfig(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const modeValue =
    typeof payload.mode === "string"
      ? payload.mode
      : typeof payload.authMode === "string"
      ? payload.authMode
      : null;
  if (modeValue) {
    authConfig.mode = modeValue;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "loginUrl")) {
    authConfig.loginUrl = payload.loginUrl || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "devLoginAllowed")) {
    authConfig.devLoginAllowed = Boolean(payload.devLoginAllowed);
  }
  applyAuthConfigUi();
}

function applyAuthConfigUi() {
  if (dom.loginForm) {
    if (authConfig.devLoginAllowed) {
      dom.loginForm.removeAttribute("hidden");
    } else {
      dom.loginForm.setAttribute("hidden", "");
    }
  }

  if (dom.oidcButton) {
    if (authConfig.mode === "oidc") {
      dom.oidcButton.hidden = false;
      dom.oidcButton.disabled = !authConfig.loginUrl;
    } else {
      dom.oidcButton.hidden = true;
    }
  }

  if (dom.loginSubtitle) {
    if (authConfig.mode === "oidc" && !authConfig.devLoginAllowed) {
      dom.loginSubtitle.textContent = "Use single sign-on to access your notes.";
    } else if (authConfig.mode === "oidc") {
      dom.loginSubtitle.textContent = "Use single sign-on or enter a name to load your notes.";
    } else {
      dom.loginSubtitle.textContent = "Enter a name to load your notes.";
    }
  }
}

function handleOidcLogin() {
  if (authConfig.loginUrl) {
    window.location.assign(authConfig.loginUrl);
  } else {
    alert("Single sign-on is not configured.");
  }
}

async function handleSearchSubmit(event) {
  event.preventDefault();
  const term = dom.searchInput ? dom.searchInput.value.trim() : "";
  await loadNotes(term, state.view);
}

async function handleLogin(event) {
  event.preventDefault();

  if (!authConfig.devLoginAllowed) {
    if (authConfig.mode === "oidc" && authConfig.loginUrl) {
      window.location.assign(authConfig.loginUrl);
    } else {
      alert("Manual login is disabled.");
    }
    return;
  }

  const username = dom.usernameInput.value.trim();
  if (!username) {
    return;
  }

  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        mergeAuthConfig(payload);
      }
      throw new Error("Failed to log in");
    }

    const data = await response.json();
    state.currentUser = data.username;
    dom.usernameInput.value = "";
    showApp();
    await loadNotes("", state.view);
  } catch (error) {
    console.error(error);
    alert("Could not log in. Please try again.");
  }
}

async function loadNotes(searchTerm = state.searchTerm || "", view = state.view) {
  if (!state.currentUser) {
    return;
  }

  const query = typeof searchTerm === "string" ? searchTerm.trim() : "";
  state.searchTerm = query;
  if (dom.searchInput) {
    dom.searchInput.value = query;
  }

  const targetView = view || state.view || "active";
  if (!query) {
    state.view = targetView;
  }

  updateViewControls();

  let url = "/api/notes";
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  } else if (targetView === "archived") {
    params.set("folder", "archived");
  }

  const qs = params.toString();
  if (qs) {
    url += `?${qs}`;
  }

  try {
    const response = await fetch(url, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        const payload = await response.json().catch(() => ({}));
        mergeAuthConfig(payload);
        await logout({ silent: true });
        return;
      }
      throw new Error("Failed to fetch notes");
    }

    const data = await response.json();
    state.notes = Array.isArray(data.notes)
      ? data.notes.map((note) => ({ ...note, archived: Boolean(note.archived) }))
      : [];
    sortNotes();
    renderNotes();
    updateViewControls();
  } catch (error) {
    console.error(error);
    alert("Could not load notes. Please try again.");
  }
}

function renderNotes() {
  dom.notesContainer.innerHTML = "";

  if (!state.notes.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    if (state.searchTerm) {
      empty.textContent = "No notes match your search.";
    } else if (state.view === "archived") {
      empty.textContent = "Archived notes will appear here.";
    } else {
      empty.textContent = "No notes yet. Hit the plus to start one.";
    }
    dom.notesContainer.appendChild(empty);
    return;
  }

  state.notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";
    if (note.archived) {
      card.classList.add("note-card--archived");
    }
    card.tabIndex = 0;

    if (note.archived) {
      const badge = document.createElement("span");
      badge.className = "note-card__badge";
      badge.textContent = "Archived";
      card.append(badge);
    }

    const titleEl = document.createElement("h3");
    titleEl.className = "note-card__title";
    titleEl.textContent = note.title || "Untitled";

    const bodyEl = document.createElement("p");
    bodyEl.className = "note-card__body";
    bodyEl.textContent = note.body || "";

    card.append(titleEl, bodyEl);

    const open = () => {
      openModal({
        mode: "edit",
        note,
      });
    };

    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });

    dom.notesContainer.appendChild(card);
  });
}

function openModal({ mode, note }) {
  state.editing = { mode, note: { ...note } };
  dom.modalTitle.textContent = mode === "new" ? "New note" : "Edit note";
  dom.noteTitleInput.value = note.title || "";
  dom.noteBodyInput.value = note.body || "";

  if (dom.deleteButton) {
    const showDelete = mode === "edit";
    dom.deleteButton.hidden = !showDelete;
    dom.deleteButton.disabled = !showDelete;
    dom.deleteButton.textContent = note.archived ? "Delete forever" : "Archive";
  }

  dom.modal.classList.add("is-open");
  document.body.classList.add("modal-open");
  dom.noteTitleInput.focus();
}

function closeModal() {
  state.editing = null;
  dom.modal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  if (dom.deleteButton) {
    dom.deleteButton.hidden = true;
    dom.deleteButton.disabled = true;
    dom.deleteButton.textContent = "Archive";
  }
}

async function handleNoteSubmit(event) {
  event.preventDefault();
  if (!state.editing || !state.currentUser) {
    return;
  }

  const title = dom.noteTitleInput.value.trim();
  const body = dom.noteBodyInput.value.trim();

  try {
    let response;

    if (state.editing.mode === "new") {
      response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, body }),
      });
    } else {
      response = await fetch(`/api/notes/${state.editing.note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, body }),
      });
    }

    if (!response.ok) {
      if (response.status === 401) {
        const payload = await response.json().catch(() => ({}));
        mergeAuthConfig(payload);
        await logout({ silent: true });
        return;
      }
      throw new Error("Failed to save note");
    }

    await response.json();
    await loadNotes(state.searchTerm, state.view);
    closeModal();
  } catch (error) {
    console.error(error);
    alert("Could not save the note. Please try again.");
  }
}

async function handleDeleteNote() {
  if (!state.editing || state.editing.mode !== "edit" || !state.currentUser) {
    return;
  }

  const noteId = state.editing.note.id;
  if (!noteId) {
    return;
  }

  const promptMessage = state.editing.note.archived
    ? "Delete this note permanently?"
    : "Archive this note?";
  const shouldDelete = window.confirm(promptMessage);
  if (!shouldDelete) {
    return;
  }

  try {
    const response = await fetch(`/api/notes/${noteId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.status === 200) {
      await response.json().catch(() => ({}));
      await loadNotes(state.searchTerm, state.view);
      closeModal();
      return;
    }

    if (response.status === 204) {
      await loadNotes(state.searchTerm, state.view);
      closeModal();
      return;
    }

    if (response.status === 401) {
      const payload = await response.json().catch(() => ({}));
      mergeAuthConfig(payload);
      await logout({ silent: true });
      return;
    }

    if (response.status === 404) {
      state.notes = state.notes.filter((note) => note.id !== noteId);
      renderNotes();
      closeModal();
      alert("Note not found.");
      return;
    }

    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.error === "string" ? payload.error : "Could not delete the note. Please try again.";
    alert(message);
  } catch (error) {
    console.error(error);
    alert("Could not delete the note. Please try again.");
  }
}

function sortNotes() {
  state.notes.sort((a, b) => {
    if (a.archived !== b.archived) {
      return a.archived ? 1 : -1;
    }
    const left = a.updatedAt || a.createdAt || 0;
    const right = b.updatedAt || b.createdAt || 0;
    return right - left;
  });
}

function showApp() {
  dom.loginPanel.classList.add("is-hidden");
  dom.app.classList.add("is-visible");
}

function hideApp() {
  dom.loginPanel.classList.remove("is-hidden");
  dom.app.classList.remove("is-visible");
  dom.notesContainer.innerHTML = "";
  state.view = "active";
  updateViewControls();
}

async function restoreSession() {
  try {
    const response = await fetch("/api/session", {
      credentials: "include",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      mergeAuthConfig(payload);
      return;
    }

    const data = await response.json();
    if (!data.username) {
      return;
    }

    state.currentUser = data.username;
    showApp();
    await loadNotes("", state.view);
  } catch (error) {
    console.error(error);
  }
}

async function logout(options = {}) {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    if (!options.silent) {
      console.error(error);
    }
  }

  state.currentUser = null;
  state.notes = [];
  state.searchTerm = "";
  state.view = "active";
  hideApp();
  if (dom.searchInput) {
    dom.searchInput.value = "";
  }
  applyAuthConfigUi();
}

window.notesLite = {
  logout,
};

(async function init() {
  await loadAuthConfig();
  await restoreSession();
  updateViewControls();
})();
