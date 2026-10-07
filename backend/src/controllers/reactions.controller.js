const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');
const { DELETED_PEER_ERROR, isReadOnlyDirectConversation } = require('../utils/deletedUsers');
const { toAllowedReaction } = require('../utils/reactions');

// Ajoute ou retire la réaction de l'utilisateur sur un message (« toggle ») :
// cliquer une première fois ajoute l'emoji, cliquer à nouveau le retire.
// Chaque utilisateur peut poser plusieurs emojis différents sur un même message.
// L'appartenance à la conversation est déjà vérifiée par requireConversationMember.
const toggleReaction = asyncHandler(async (req, res) => {
  const { conversationId, messageId } = req.params;

  const emoji = toAllowedReaction(req.body.emoji);
  if (!emoji) {
    return res.status(400).json({ error: 'Réaction non autorisée' });
  }

  if (await isReadOnlyDirectConversation(conversationId)) {
    return res.status(403).json({ error: DELETED_PEER_ERROR });
  }

  // Le message doit appartenir à CETTE conversation : sans ce filtre, un membre
  // pourrait réagir à un message d'une conversation dont il n'est pas membre.
  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
    select: { id: true },
  });
  if (!message) {
    return res.status(404).json({ error: 'Message introuvable' });
  }

  const key = { messageId_userId_emoji: { messageId, userId: req.userId, emoji } };
  const existing = await prisma.reaction.findUnique({ where: key });

  if (existing) {
    await prisma.reaction.deleteMany({ where: { messageId, userId: req.userId, emoji } });
  } else {
    try {
      await prisma.reaction.create({ data: { messageId, userId: req.userId, emoji } });
    } catch (err) {
      // Deux clics quasi simultanés : l'autre requête a déjà posé la réaction.
      if (err.code !== 'P2002') throw err;
    }
  }

  const reactions = await prisma.reaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
    orderBy: { createdAt: 'asc' },
  });

  const payload = { conversationId, messageId, reactions };

  const io = req.app.get('io');
  if (io) io.to(`conversation:${conversationId}`).emit('reaction_updated', payload);

  res.json({ ...payload, added: !existing });
});

module.exports = { toggleReaction };
