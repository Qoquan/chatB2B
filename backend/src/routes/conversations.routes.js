const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  addMembers,
  getMessages,
  markAsRead,
} = require('../controllers/conversations.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listConversations);
router.post('/', createConversation);
router.patch('/:conversationId', updateConversation);
router.delete('/:conversationId', deleteConversation);
router.post('/:conversationId/members', addMembers);
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/read', markAsRead);

module.exports = router;
