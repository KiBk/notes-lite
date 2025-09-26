const express = require('express');
const userService = require('../services/userService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const user = await userService.upsertUser(name);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
