const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const {
  listConversations,
  createConversation,
  getMessages,
} = require('../controllers/conversations.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listConversations);
router.post('/', createConversation);
router.get('/:conversationId/messages', getMessages);

module.exports = router;
