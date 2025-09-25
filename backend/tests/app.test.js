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

    async listNotes(username) {
      return getUserNotes(username).map((note) => ({ ...note }));
    },

    async searchNotes(username, query) {
      const needle = query.toLowerCase();
      return getUserNotes(username)
        .filter((note) => {
          const title = (note.title || "").toLowerCase();
          const body = (note.body || "").toLowerCase();
          return title.includes(needle) || body.includes(needle);
        })
        .map((note) => ({ ...note }));
    },

    async createNote({ id, username, title, body }) {
      const now = Date.now();
      const note = {
        id,
        title,
        body,
        createdAt: now,
        updatedAt: now,
      };
      getUserNotes(username).push({ ...note });
      return { ...note };
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

    async deleteNote({ id, username }) {
      const items = getUserNotes(username);
      const index = items.findIndex((note) => note.id === id);
      if (index === -1) {
        return false;
      }
      items.splice(index, 1);
      return true;
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
  await agent.post("/api/notes").send({ title: "Groceries", body: "Buy milk" }).expect(201);
  await agent
    .post("/api/notes")
    .send({ title: "Workout", body: "Leg day" })
    .expect(201);

  const searchRes = await agent.get("/api/notes?q=milk").expect(200);
  assert.equal(searchRes.body.notes.length, 1);
  assert.equal(searchRes.body.notes[0].title, "Groceries");

  const emptyRes = await agent.get("/api/notes?q=xyz").expect(200);
  assert.equal(emptyRes.body.notes.length, 0);
});

test("delete endpoint removes a note", async () => {
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

  await agent.delete(`/api/notes/${noteId}`).expect(204);

  const afterDelete = await agent.get("/api/notes").expect(200);
  assert.equal(afterDelete.body.notes.length, 0);

  await agent.delete(`/api/notes/${noteId}`).expect(404);
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
