const prisma = require('../config/db');

// Liste les conversations de l'utilisateur connecté
async function listConversations(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: {
      members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(conversations);
}

// Crée une conversation privée (1:1) ou de groupe
async function createConversation(req, res) {
  const { memberIds, isGroup, name } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds requis (tableau non vide)' });
  }
  if (isGroup && !name) {
    return res.status(400).json({ error: 'Un nom est requis pour une conversation de groupe' });
  }

  const allMemberIds = [...new Set([...memberIds, req.userId])];

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: !!isGroup,
      name: isGroup ? name : null,
      members: {
        create: allMemberIds.map((userId) => ({ userId })),
      },
    },
    include: { members: true },
  });

  res.status(201).json(conversation);
}

// Récupère les messages d'une conversation (avec vérification d'accès)
async function getMessages(req, res) {
  const { conversationId } = req.params;

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: req.userId, conversationId } },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json(messages);
}

module.exports = { listConversations, createConversation, getMessages };
