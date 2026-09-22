const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');

// Liste les conversations de l'utilisateur connecté, avec dernier message
// et compteur de messages non lus (pour badge/notification)
const listConversations = asyncHandler(async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  const withUnreadCount = await Promise.all(
    conversations.map(async (conv) => {
      const myMembership = conv.members.find((m) => m.userId === req.userId);
      const lastReadAt = myMembership && myMembership.lastReadAt;
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: req.userId },
          createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
        },
      });
      return Object.assign({}, conv, { unreadCount: unreadCount });
    })
  );

  res.json(withUnreadCount);
});

// Crée une conversation privée (1:1) ou de groupe.
// Pour une conversation 1:1, réutilise une conversation existante entre les
// deux mêmes utilisateurs plutôt que d'en créer une nouvelle à chaque fois.
const createConversation = asyncHandler(async (req, res) => {
  const { memberIds, isGroup, name } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds requis (tableau non vide)' });
  }
  if (memberIds.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    return res.status(400).json({ error: "memberIds doit être un tableau d'identifiants valides" });
  }
  if (isGroup && (!name || typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Un nom est requis pour une conversation de groupe' });
  }

  const allMemberIds = [...new Set([...memberIds, req.userId])];

  // Vérifie que tous les utilisateurs invités existent réellement
  const existingUsersCount = await prisma.user.count({ where: { id: { in: allMemberIds } } });
  if (existingUsersCount !== allMemberIds.length) {
    return res
      .status(400)
      .json({ error: 'Un ou plusieurs utilisateurs invités sont introuvables' });
  }

  if (!isGroup && allMemberIds.length === 2) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: allMemberIds.map((userId) => ({
          members: { some: { userId: userId } },
        })),
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      },
    });

    if (existing) {
      return res.status(200).json(existing);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: !!isGroup,
      name: isGroup ? name.trim() : null,
      members: {
        create: allMemberIds.map((userId) => ({ userId: userId })),
      },
    },
    include: {
      members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
    },
  });

  res.status(201).json(conversation);
});

// Récupère les messages d'une conversation (avec vérification d'accès)
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: req.userId, conversationId: conversationId } },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversationId },
    include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json(messages);
});

// Marque une conversation comme lue par l'utilisateur connecté
const markAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: req.userId, conversationId: conversationId } },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }

  await prisma.conversationMember.update({
    where: { userId_conversationId: { userId: req.userId, conversationId: conversationId } },
    data: { lastReadAt: new Date() },
  });

  res.json({ success: true });
});

module.exports = { listConversations, createConversation, getMessages, markAsRead };
