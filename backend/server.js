const { createApp } = require("./app");
const db = require("./db");

const app = createApp({ db });
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Notes API listening on port ${PORT}`);
});
