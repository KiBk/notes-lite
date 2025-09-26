const express = require('express');
const cors = require('cors');

const sessionRouter = require('./routes/session');
const notesRouter = require('./routes/notes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/session', sessionRouter);
app.use('/api/notes', notesRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
