const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");

function resolveConfigValue(config, key, fallback, allowNull = false) {
  if (Object.prototype.hasOwnProperty.call(config, key)) {
    const value = config[key];
    if (value === null && !allowNull) {
      return fallback;
    }
    return value;
  }
  return fallback;
}

function createApp({ db, config = {} }) {
  if (!db) {
    throw new Error("A database implementation must be provided");
  }

  const isProduction = resolveConfigValue(
    config,
    "isProduction",
    process.env.NODE_ENV === "production"
  );

  const cookieName = resolveConfigValue(
    config,
    "cookieName",
    process.env.COOKIE_NAME || "notes_user"
  );

  const cookieSecure = resolveConfigValue(
    config,
    "cookieSecure",
    process.env.COOKIE_SECURE === "true" || isProduction
  );

  const sessionMaxAge = resolveConfigValue(
    config,
    "sessionMaxAge",
    Number(process.env.SESSION_MAX_AGE || 1000 * 60 * 60 * 24 * 30)
  );

  const stateCookieName = resolveConfigValue(
    config,
    "stateCookieName",
    process.env.STATE_COOKIE_NAME || "oidc_state"
  );

  const enableDevLogin = resolveConfigValue(
    config,
    "enableDevLogin",
    process.env.ENABLE_DEV_LOGIN
      ? process.env.ENABLE_DEV_LOGIN === "true"
      : !isProduction
  );

  const devAutoLoginUsername = Object.prototype.hasOwnProperty.call(
    config,
    "devAutoLoginUsername"
  )
    ? config.devAutoLoginUsername
    : enableDevLogin
    ? process.env.DEV_AUTO_LOGIN_USERNAME || "admin"
    : null;

  const loginPath = resolveConfigValue(
    config,
    "loginPath",
    "/api/auth/oidc/login"
  );

  const callbackPath = resolveConfigValue(
    config,
    "callbackPath",
    "/api/auth/oidc/callback"
  );

  const oidcEnvConfig = process.env.OIDC_ISSUER
    ? {
        issuer: process.env.OIDC_ISSUER,
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        callbackUrl: process.env.OIDC_CALLBACK_URL,
        scope: process.env.OIDC_SCOPE,
      }
    : null;

  const oidcConfig = resolveConfigValue(
    config,
    "oidc",
    oidcEnvConfig,
    true
  );

  const customOidcAdapter = resolveConfigValue(
    config,
    "oidcAdapter",
    null,
    true
  );

  let authMode = "local";
  let oidcAuth = null;

  if (customOidcAdapter) {
    authMode = "oidc";
    oidcAuth = customOidcAdapter;
  } else if (oidcConfig) {
    authMode = "oidc";
    const OidcAuth = require("./oidc");
    oidcAuth = new OidcAuth({
      issuer: oidcConfig.issuer,
      clientId: oidcConfig.clientId,
      clientSecret: oidcConfig.clientSecret,
      callbackUrl:
        oidcConfig.callbackUrl ||
        `http://localhost:${process.env.PORT || 5000}${callbackPath}`,
      scope: oidcConfig.scope,
    });
  }

  const app = express();

  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  function sanitizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function sessionCookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: Boolean(cookieSecure),
      maxAge: sessionMaxAge,
    };
  }

  function setSessionCookie(res, username) {
    res.cookie(cookieName, username, sessionCookieOptions());
  }

  function clearSessionCookie(res) {
    const options = sessionCookieOptions();
    delete options.maxAge;
    res.clearCookie(cookieName, options);
  }

  function sendUnauthenticated(res) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      authMode,
      loginUrl: authMode === "oidc" ? loginPath : null,
      devLoginAllowed: enableDevLogin,
    });
  }

  function requireUser(req, res, next) {
    const username = req.cookies[cookieName];
    if (!username) {
      return sendUnauthenticated(res);
    }
    req.username = username;
    next();
  }

  app.get("/api/auth/config", (req, res) => {
    res.json({
      mode: authMode,
      loginUrl: authMode === "oidc" ? loginPath : null,
      devLoginAllowed: enableDevLogin,
    });
  });

  if (authMode === "oidc") {
    app.get(loginPath, async (req, res) => {
      try {
        const { authorizationUrl, state, nonce } = await oidcAuth.createAuthRequest();
        res.cookie(stateCookieName, JSON.stringify({ state, nonce }), {
          httpOnly: true,
          sameSite: "lax",
          secure: Boolean(cookieSecure),
          maxAge: 1000 * 60 * 10,
        });
        res.redirect(authorizationUrl);
      } catch (error) {
        console.error("OIDC login failed", error);
        res.status(500).send("OIDC login failed");
      }
    });

    app.get(callbackPath, async (req, res) => {
      const stored = req.cookies[stateCookieName];
      if (!stored) {
        return res.status(400).send("Missing OIDC state");
      }

      let payload;
      try {
        payload = JSON.parse(stored);
      } catch (_error) {
        return res.status(400).send("Invalid OIDC state");
      }

      res.clearCookie(stateCookieName, {
        httpOnly: true,
        sameSite: "lax",
        secure: Boolean(cookieSecure),
      });

      try {
        const claims = await oidcAuth.handleCallback(req, payload);
        const username =
          sanitizeText(claims.preferred_username) ||
          sanitizeText(claims.email) ||
          sanitizeText(claims.sub);

        if (!username) {
          return res.status(400).send("OIDC response missing identifier");
        }

        const displayName = sanitizeText(claims.name) || username;
        await db.ensureUser(username, displayName);
        setSessionCookie(res, username);
        res.redirect("/");
      } catch (error) {
        console.error("OIDC callback failed", error);
        res.status(500).send("OIDC callback failed");
      }
    });
  }

  app.post("/api/session", async (req, res) => {
    if (!enableDevLogin) {
      return res.status(403).json({
        error: "DEV_LOGIN_DISABLED",
        authMode,
        loginUrl: authMode === "oidc" ? loginPath : null,
        devLoginAllowed: enableDevLogin,
      });
    }

    const username = sanitizeText(req.body?.username);
    if (!username) {
      return res.status(400).json({ error: "USERNAME_REQUIRED" });
    }

    try {
      await db.ensureUser(username);
      setSessionCookie(res, username);
      res.json({ username });
    } catch (error) {
      console.error("Failed to create session", error);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/session", async (req, res) => {
    let username = req.cookies[cookieName];

    if (!username && enableDevLogin && devAutoLoginUsername) {
      try {
        await db.ensureUser(devAutoLoginUsername);
        setSessionCookie(res, devAutoLoginUsername);
        username = devAutoLoginUsername;
      } catch (error) {
        console.error("Failed to materialize dev session", error);
      }
    }

    if (!username) {
      return sendUnauthenticated(res);
    }

    res.json({ username, authMode });
  });

  app.post("/api/logout", (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get("/api/notes", requireUser, async (req, res) => {
    try {
      const searchTerm = sanitizeText(req.query?.q || "");
      const folder = sanitizeText(req.query?.folder || "").toLowerCase();
      let notes;
      if (searchTerm) {
        if (typeof db.searchNotes === "function") {
          notes = await db.searchNotes(req.username, searchTerm);
        } else {
          const allNotes = await db.listNotes(req.username);
          const needle = searchTerm.toLowerCase();
          notes = allNotes.filter((note) => {
            const title = (note.title || "").toLowerCase();
            const body = (note.body || "").toLowerCase();
            return title.includes(needle) || body.includes(needle);
          });
        }
      } else {
        const archived = folder === "archived";
        notes = await db.listNotes(req.username, { archived });
      }
      res.json({ notes });
    } catch (error) {
      console.error("Failed to fetch notes", error);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  app.post("/api/notes", requireUser, async (req, res) => {
    const title = sanitizeText(req.body?.title);
    const body = sanitizeText(req.body?.body);

    if (!title && !body) {
      return res.status(400).json({ error: "NOTE_CONTENT_REQUIRED" });
    }

    const note = {
      id: crypto.randomUUID(),
      title,
      body,
    };

    try {
      const saved = await db.createNote({ ...note, username: req.username });
      res.status(201).json({ note: saved });
    } catch (error) {
      console.error("Failed to create note", error);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  app.put("/api/notes/:id", requireUser, async (req, res) => {
    const noteId = req.params.id;
    const title = sanitizeText(req.body?.title);
    const body = sanitizeText(req.body?.body);

    if (!title && !body) {
      return res.status(400).json({ error: "NOTE_CONTENT_REQUIRED" });
    }

    try {
      const updated = await db.updateNote({
        id: noteId,
        username: req.username,
        title,
        body,
      });
      if (!updated) {
        return res.status(404).json({ error: "NOTE_NOT_FOUND" });
      }
      res.json({ note: updated });
    } catch (error) {
      console.error("Failed to update note", error);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  app.delete("/api/notes/:id", requireUser, async (req, res) => {
    const noteId = req.params.id;
    try {
      if (typeof db.getNote !== "function") {
        return res.status(501).json({ error: "NOTE_LOOKUP_NOT_SUPPORTED" });
      }

      const existing = await db.getNote({ id: noteId, username: req.username });
      if (!existing) {
        return res.status(404).json({ error: "NOTE_NOT_FOUND" });
      }

      if (!existing.archived) {
        if (typeof db.archiveNote !== "function") {
          return res.status(501).json({ error: "ARCHIVE_NOT_SUPPORTED" });
        }
        const archivedNote = await db.archiveNote({ id: noteId, username: req.username });
        if (!archivedNote) {
          return res.status(404).json({ error: "NOTE_NOT_FOUND" });
        }
        return res.status(200).json({ note: archivedNote });
      }

      if (typeof db.deleteNote !== "function") {
        return res.status(501).json({ error: "DELETE_NOT_SUPPORTED" });
      }

      const removed = await db.deleteNote({ id: noteId, username: req.username });
      if (!removed) {
        return res.status(404).json({ error: "NOTE_NOT_FOUND" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Failed to delete note", error);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  return app;
}

module.exports = {
  createApp,
};
