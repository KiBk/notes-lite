const app = require('./app');
const db = require('./db');

const PORT = process.env.PORT || 4000;

async function start({ retries = 5, delayMs = 1000 } = {}) {
  let attempt = 0;
  // retry loop in case the database host is not yet reachable during container boot
  while (attempt <= retries) {
    try {
      await db.migrate();
      app.listen(PORT, () => {
        console.log(`Backend listening on port ${PORT}`);
      });
      return;
    } catch (err) {
      attempt += 1;
      if (attempt > retries) {
        throw err;
      }
      const waitTime = delayMs * attempt;
      console.warn(
        `Database not ready (attempt ${attempt} of ${retries}). Retrying in ${waitTime}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = { start };
