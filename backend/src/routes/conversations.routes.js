const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireConversationMember } = require('../middleware/conversation.middleware');
const { uploadSingleFile } = require('../middleware/upload.middleware');
const {
  listConversations,
  createConversation,
  getMessages,
  markAsRead,
} = require('../controllers/conversations.controller');
const { uploadAttachment, downloadAttachment } = require('../controllers/attachments.controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', listConversations);
router.post('/', createConversation);
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/read', markAsRead);

// Pièces jointes : membre vérifié d'abord, puis réception du fichier
router.post(
  '/:conversationId/attachments',
  requireConversationMember,
  uploadSingleFile,
  uploadAttachment
);
router.get(
  '/:conversationId/attachments/:attachmentId',
  requireConversationMember,
  downloadAttachment
);

module.exports = router;
