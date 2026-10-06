const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { listUsers, getMe, updateMe, changePassword } = require('../controllers/users.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listUsers);
router.get('/me', getMe);
router.patch('/me', updateMe);
router.put('/me/password', changePassword);

module.exports = router;
