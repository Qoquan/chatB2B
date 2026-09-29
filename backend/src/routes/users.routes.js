const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { listUsers } = require('../controllers/users.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listUsers);

module.exports = router;
