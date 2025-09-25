const dom = {
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  loginSubtitle: document.querySelector(".login__subtitle"),
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
};

const state = {
  currentUser: null,
  notes: [],
  editing: null,
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
    note: { id: null, title: "", body: "" },
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
    await loadNotes();
  } catch (error) {
    console.error(error);
    alert("Could not log in. Please try again.");
  }
}

async function loadNotes() {
  if (!state.currentUser) {
    return;
  }

  try {
    const response = await fetch("/api/notes", {
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
    state.notes = data.notes || [];
    sortNotes();
    renderNotes();
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
    empty.textContent = "No notes yet. Hit the plus to start one.";
    dom.notesContainer.appendChild(empty);
    return;
  }

  state.notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";
    card.tabIndex = 0;

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

  dom.modal.classList.add("is-open");
  document.body.classList.add("modal-open");
  dom.noteTitleInput.focus();
}

function closeModal() {
  state.editing = null;
  dom.modal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
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

    const data = await response.json();
    upsertNote(data.note);
    closeModal();
    sortNotes();
    renderNotes();
  } catch (error) {
    console.error(error);
    alert("Could not save the note. Please try again.");
  }
}

function upsertNote(note) {
  const index = state.notes.findIndex((item) => item.id === note.id);
  if (index === -1) {
    state.notes.push(note);
  } else {
    state.notes[index] = note;
  }
}

function sortNotes() {
  state.notes.sort((a, b) => {
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
    await loadNotes();
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
  hideApp();
  applyAuthConfigUi();
}

window.notesLite = {
  logout,
};

(async function init() {
  await loadAuthConfig();
  await restoreSession();
})();
