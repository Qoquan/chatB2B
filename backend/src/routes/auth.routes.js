const express = require('express');
const { register, login } = require('../controllers/auth.controller');
const { loginLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', loginLimiter, login);

module.exports = router;
