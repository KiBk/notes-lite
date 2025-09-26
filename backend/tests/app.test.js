const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../app");

function createStubDb() {
  const users = new Map();
  const notes = new Map();

  function getUserNotes(username) {
    if (!notes.has(username)) {
      notes.set(username, []);
    }
    return notes.get(username);
  }

  function copyNote(note) {
    return { ...note };
  }

  function sortNotesCollection(items) {
    return [...items].sort((a, b) => {
      if (a.archived !== b.archived) {
        return a.archived ? 1 : -1;
      }
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  return {
    async ensureUser(username, displayName = null) {
      if (!username) {
        throw new Error("Username required");
      }
      if (!users.has(username)) {
        users.set(username, { username, displayName: displayName || null });
      } else if (displayName && !users.get(username).displayName) {
        users.get(username).displayName = displayName;
      }
      getUserNotes(username);
    },

    async listNotes(username, options = {}) {
      const { archived } = options;
      let items = getUserNotes(username);
      if (typeof archived === "boolean") {
        items = items.filter((note) => note.archived === archived);
      }
      return sortNotesCollection(items).map(copyNote);
    },

    async searchNotes(username, query) {
      const needle = query.toLowerCase();
      const matched = getUserNotes(username).filter((note) => {
        const title = (note.title || "").toLowerCase();
        const body = (note.body || "").toLowerCase();
        return title.includes(needle) || body.includes(needle);
      });
      return sortNotesCollection(matched).map(copyNote);
    },

    async createNote({ id, username, title, body }) {
      const now = Date.now();
      const note = {
        id,
        title,
        body,
        createdAt: now,
        updatedAt: now,
        archived: false,
        pinned: false,
        position:
          getUserNotes(username)
            .filter((item) => !item.archived)
            .reduce((max, item) => Math.max(max, item.position || 0), 0) + 1,
      };
      getUserNotes(username).push(copyNote(note));
      return copyNote(note);
    },

    async updateNote({ id, username, title, body }) {
      const items = getUserNotes(username);
      const index = items.findIndex((note) => note.id === id);
      if (index === -1) {
        return null;
      }
      const now = Date.now();
      const updated = {
        ...items[index],
        title,
        body,
        updatedAt: now,
      };
      items[index] = { ...updated };
      return { ...updated };
    },

    async archiveNote({ id, username }) {
      const items = getUserNotes(username);
      const index = items.findIndex((note) => note.id === id && note.archived === false);
      if (index === -1) {
        return null;
      }
      const now = Date.now();
      const archivedNote = {
        ...items[index],
        archived: true,
        pinned: false,
        updatedAt: now,
        position:
          items
            .filter((item) => item.archived)
            .reduce((max, item) => Math.max(max, item.position || 0), 0) + 1,
      };
      items[index] = { ...archivedNote };
      return copyNote(archivedNote);
    },

    async getNote({ id, username }) {
      const items = getUserNotes(username);
      const found = items.find((note) => note.id === id);
      return found ? copyNote(found) : null;
    },

    async unarchiveNote({ id, username }) {
      const items = getUserNotes(username);
      const index = items.findIndex((note) => note.id === id && note.archived === true);
      if (index === -1) {
        return null;
      }
      const now = Date.now();
      const activePosition = items
        .filter((note) => !note.archived)
        .reduce((max, note) => Math.max(max, note.position || 0), 0);
      const note = {
        ...items[index],
        archived: false,
        pinned: false,
        position: activePosition + 1,
        updatedAt: now,
      };
      items[index] = { ...note };
      return copyNote(note);
    },

    async deleteNote({ id, username }) {
      const items = getUserNotes(username);
      const index = items.findIndex((note) => note.id === id);
      if (index === -1) {
        return false;
      }
      items.splice(index, 1);
      return true;
    },

    async pinNote({ id, username, pinned }) {
      const items = getUserNotes(username);
      const note = items.find((item) => item.id === id && !item.archived);
      if (!note) {
        return null;
      }
      note.pinned = Boolean(pinned);
      note.updatedAt = Date.now();
      if (note.pinned) {
        note.position = items
          .filter((item) => item.pinned && !item.archived)
          .reduce((max, item) => Math.max(max, item.position || 0), 0) + 1;
      } else {
        note.position = items
          .filter((item) => !item.pinned && !item.archived)
          .reduce((max, item) => Math.max(max, item.position || 0), 0) + 1;
      }
      return copyNote(note);
    },

    async reorderNotes({ username, archived, pinnedIds = [], unpinnedIds = [], ids }) {
      const items = getUserNotes(username);
      const now = Date.now();

      if (archived) {
        const order = Array.isArray(ids) && ids.length ? ids : Array.isArray(unpinnedIds) ? unpinnedIds : [];
        let position = 1;
        order.forEach((id) => {
          const target = items.find((note) => note.id === id && note.archived === archived);
          if (target) {
            target.position = position;
            target.updatedAt = now;
            position += 1;
          }
        });
      } else {
        let position = 1;
        pinnedIds.forEach((id) => {
          const target = items.find((note) => note.id === id && !note.archived);
          if (target) {
            target.pinned = true;
            target.position = position;
            target.updatedAt = now;
            position += 1;
          }
        });

        position = 1;
        unpinnedIds.forEach((id) => {
          const target = items.find((note) => note.id === id && !note.archived);
          if (target) {
            target.pinned = false;
            target.position = position;
            target.updatedAt = now;
            position += 1;
          }
        });
      }

      return sortNotesCollection(items.filter((note) => note.archived === archived)).map(copyNote);
    },
  };
}

test("rejects unauthenticated requests", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: null, cookieSecure: false },
  });

  const res = await request(app).get("/api/notes").expect(401);
  assert.equal(res.body.error, "UNAUTHENTICATED");
  assert.equal(res.body.devLoginAllowed, true);
  assert.equal(res.body.authMode, "local");
});

test("dev login flow supports creating and updating notes", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: null, cookieSecure: false },
  });
  const agent = request.agent(app);

  const loginRes = await agent
    .post("/api/session")
    .send({ username: "alice" })
    .expect(200);
  assert.equal(loginRes.body.username, "alice");
  assert.ok(Array.isArray(loginRes.headers["set-cookie"]));

  const createRes = await agent
    .post("/api/notes")
    .send({ title: "Shopping", body: "Eggs" })
    .expect(201);
  assert.equal(createRes.body.note.title, "Shopping");
  const noteId = createRes.body.note.id;
  assert.ok(noteId);

  const listRes = await agent.get("/api/notes").expect(200);
  assert.equal(listRes.body.notes.length, 1);
  assert.equal(listRes.body.notes[0].body, "Eggs");

  const updateRes = await agent
    .put(`/api/notes/${noteId}`)
    .send({ title: "Shopping", body: "Eggs, Milk" })
    .expect(200);
  assert.equal(updateRes.body.note.body, "Eggs, Milk");

  const listAfterUpdate = await agent.get("/api/notes").expect(200);
  assert.equal(listAfterUpdate.body.notes[0].body, "Eggs, Milk");
});

test("auto login provides session when configured", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: "admin", cookieSecure: false },
  });
  const agent = request.agent(app);

  const sessionRes = await agent.get("/api/session").expect(200);
  assert.equal(sessionRes.body.username, "admin");
});

test("manual login disabled when dev login is off", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: false, cookieSecure: false },
  });

  const res = await request(app)
    .post("/api/session")
    .send({ username: "carol" })
    .expect(403);
  assert.equal(res.body.error, "DEV_LOGIN_DISABLED");
  assert.equal(res.body.devLoginAllowed, false);
});

test("search endpoint filters notes by query", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: null, cookieSecure: false },
  });
  const agent = request.agent(app);

  await agent.post("/api/session").send({ username: "dave" }).expect(200);
  await agent
    .post("/api/notes")
    .send({ title: "Groceries", body: "Buy milk" })
    .expect(201);
  const workoutRes = await agent
    .post("/api/notes")
    .send({ title: "Workout", body: "Leg day" })
    .expect(201);

  const searchRes = await agent.get("/api/notes?q=milk").expect(200);
  assert.equal(searchRes.body.notes.length, 1);
  assert.equal(searchRes.body.notes[0].title, "Groceries");
  assert.equal(searchRes.body.notes[0].archived, false);

  await agent.delete(`/api/notes/${workoutRes.body.note.id}`).expect(200);

  const broadSearch = await agent.get("/api/notes?q=o").expect(200);
  assert.equal(broadSearch.body.notes.length, 2);
  assert.equal(broadSearch.body.notes[0].archived, false);
  assert.equal(broadSearch.body.notes[1].archived, true);
  assert.deepEqual(
    broadSearch.body.notes.map((note) => note.title),
    ["Groceries", "Workout"]
  );

  const emptyRes = await agent.get("/api/notes?q=xyz").expect(200);
  assert.equal(emptyRes.body.notes.length, 0);
});

test("delete endpoint archives then removes a note", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: null, cookieSecure: false },
  });
  const agent = request.agent(app);

  await agent.post("/api/session").send({ username: "erin" }).expect(200);
  const createRes = await agent
    .post("/api/notes")
    .send({ title: "Temp", body: "Delete me" })
    .expect(201);
  const noteId = createRes.body.note.id;

  const archiveRes = await agent.delete(`/api/notes/${noteId}`).expect(200);
  assert.equal(archiveRes.body.note.archived, true);

  const archivedList = await agent.get("/api/notes?folder=archived").expect(200);
  assert.equal(archivedList.body.notes.length, 1);
  assert.equal(archivedList.body.notes[0].archived, true);

  const afterArchiveActive = await agent.get("/api/notes").expect(200);
  assert.equal(afterArchiveActive.body.notes.length, 0);

  await agent.delete(`/api/notes/${noteId}`).expect(204);

  const archivedAfterDelete = await agent.get("/api/notes?folder=archived").expect(200);
  assert.equal(archivedAfterDelete.body.notes.length, 0);
});

test("reorder endpoint updates note ordering", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: null, cookieSecure: false },
  });
  const agent = request.agent(app);

  await agent.post("/api/session").send({ username: "frank" }).expect(200);
  const first = await agent
    .post("/api/notes")
    .send({ title: "First", body: "A" })
    .expect(201);
  const second = await agent
    .post("/api/notes")
    .send({ title: "Second", body: "B" })
    .expect(201);
  const third = await agent
    .post("/api/notes")
    .send({ title: "Third", body: "C" })
    .expect(201);

  const initial = await agent.get("/api/notes").expect(200);
  assert.deepEqual(initial.body.notes.map((n) => n.title), ["First", "Second", "Third"]);

  const reorderRes = await agent
    .put("/api/notes/order")
    .send({ pinnedIds: [], unpinnedIds: [third.body.note.id, first.body.note.id, second.body.note.id], folder: "active" })
    .expect(200);
  assert.deepEqual(reorderRes.body.notes.map((n) => n.title), ["Third", "First", "Second"]);

  const after = await agent.get("/api/notes").expect(200);
  assert.deepEqual(after.body.notes.map((n) => n.title), ["Third", "First", "Second"]);

  // Reorder archived list
  await agent.delete(`/api/notes/${first.body.note.id}`).expect(200); // archive 'First'
  await agent.delete(`/api/notes/${third.body.note.id}`).expect(200); // archive 'Third'

  const archivedBefore = await agent.get("/api/notes?folder=archived").expect(200);
  assert.deepEqual(archivedBefore.body.notes.map((n) => n.title), ["First", "Third"]);

  await agent
    .put("/api/notes/order")
    .send({ ids: [archivedBefore.body.notes[1].id, archivedBefore.body.notes[0].id], folder: "archived" })
    .expect(200);

  const archivedAfter = await agent.get("/api/notes?folder=archived").expect(200);
  assert.deepEqual(archivedAfter.body.notes.map((n) => n.title), ["Third", "First"]);

  // Unarchive and confirm placement at end of active list
  const unarchiveRes = await agent
    .post(`/api/notes/${archivedAfter.body.notes[0].id}/unarchive`)
    .expect(200);
  assert.equal(unarchiveRes.body.note.archived, false);

  const afterUnarchiveActive = await agent.get("/api/notes").expect(200);
  assert.equal(afterUnarchiveActive.body.notes.slice(-1)[0].title, "Third");
});

test("pin endpoint toggles pinned state", async () => {
  const app = createApp({
    db: createStubDb(),
    config: { enableDevLogin: true, devAutoLoginUsername: null, cookieSecure: false },
  });
  const agent = request.agent(app);

  await agent.post("/api/session").send({ username: "gina" }).expect(200);
  const first = await agent
    .post("/api/notes")
    .send({ title: "Alpha", body: "A" })
    .expect(201);
  const second = await agent
    .post("/api/notes")
    .send({ title: "Beta", body: "B" })
    .expect(201);

  await agent
    .post(`/api/notes/${first.body.note.id}/pin`)
    .send({ pinned: true })
    .expect(200);

  const afterPin = await agent.get("/api/notes").expect(200);
  assert.deepEqual(afterPin.body.notes.map((n) => ({ title: n.title, pinned: n.pinned })), [
    { title: "Alpha", pinned: true },
    { title: "Beta", pinned: false },
  ]);

  await agent
    .post(`/api/notes/${first.body.note.id}/pin`)
    .send({ pinned: false })
    .expect(200);

  const afterUnpin = await agent.get("/api/notes").expect(200);
  assert.deepEqual(afterUnpin.body.notes.map((n) => n.pinned), [false, false]);
});

test("oidc login flow issues session cookie via adapter", async () => {
  const calls = { login: 0, callback: 0 };
  const fakeOidc = {
    async createAuthRequest() {
      calls.login += 1;
      return {
        authorizationUrl: "https://idp.example/authorize",
        state: "test-state",
        nonce: "nonce-123",
      };
    },
    async handleCallback(req, payload) {
      calls.callback += 1;
      assert.equal(payload.state, "test-state");
      assert.equal(payload.nonce, "nonce-123");
      assert.equal(req.query.state, "test-state");
      assert.equal(req.query.code, "code-abc");
      return {
        preferred_username: "oidc-user",
        name: "OIDC User",
      };
    },
  };

  const app = createApp({
    db: createStubDb(),
    config: {
      enableDevLogin: false,
      cookieSecure: false,
      oidcAdapter: fakeOidc,
      loginPath: "/api/auth/oidc/login",
      callbackPath: "/api/auth/oidc/callback",
    },
  });

  const agent = request.agent(app);

  const authConfigRes = await agent.get("/api/auth/config").expect(200);
  assert.equal(authConfigRes.body.mode, "oidc");
  assert.equal(authConfigRes.body.devLoginAllowed, false);
  assert.equal(authConfigRes.body.loginUrl, "/api/auth/oidc/login");

  const loginRes = await agent.get("/api/auth/oidc/login").expect(302);
  assert.equal(loginRes.headers.location, "https://idp.example/authorize");
  assert.equal(calls.login, 1);

  const preSession = await agent.get("/api/session").expect(401);
  assert.equal(preSession.body.authMode, "oidc");

  const callbackRes = await agent
    .get("/api/auth/oidc/callback?code=code-abc&state=test-state")
    .expect(302);
  assert.equal(callbackRes.headers.location, "/");
  assert.equal(calls.callback, 1);

  const sessionRes = await agent.get("/api/session").expect(200);
  assert.equal(sessionRes.body.username, "oidc-user");

  const notesRes = await agent.get("/api/notes").expect(200);
  assert.deepEqual(notesRes.body.notes, []);
});
