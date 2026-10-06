const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');
const { isValidAvatarUrl } = require('../utils/validators');

const GROUP_NAME_MAX_LENGTH = 100;

const MEMBERS_INCLUDE = {
  members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
};

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
  const { memberIds, isGroup, name, avatarUrl } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds requis (tableau non vide)' });
  }
  if (memberIds.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    return res.status(400).json({ error: "memberIds doit être un tableau d'identifiants valides" });
  }
  if (isGroup && (!name || typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Un nom est requis pour une conversation de groupe' });
  }
  if (isGroup && name.trim().length > GROUP_NAME_MAX_LENGTH) {
    return res.status(400).json({ error: 'Le nom du groupe ne peut pas dépasser 100 caractères' });
  }
  if (isGroup && avatarUrl && !isValidAvatarUrl(avatarUrl)) {
    return res.status(400).json({ error: "L'URL de la photo doit commencer par http(s)://" });
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
      include: MEMBERS_INCLUDE,
    });

    if (existing) {
      return res.status(200).json(existing);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: !!isGroup,
      name: isGroup ? name.trim() : null,
      avatarUrl: isGroup && avatarUrl ? avatarUrl.trim() : null,
      createdById: isGroup ? req.userId : null,
      members: {
        create: allMemberIds.map((userId) => ({ userId: userId })),
      },
    },
    include: MEMBERS_INCLUDE,
  });

  notifyMembersOfNewConversation(req, conversation, allMemberIds);

  res.status(201).json(conversation);
});

// Prévient en temps réel tous les membres d'une conversation qui vient
// d'être créée : leurs connexions Socket.io (room "user:<id>") rejoignent
// automatiquement la room de cette conversation, et reçoivent l'évènement
// conversation_created pour l'ajouter immédiatement à leur liste, sans
// recharger la page.
function notifyMembersOfNewConversation(req, conversation, memberIds) {
  const io = req.app.get('io');
  if (!io) return; // pas d'instance Socket.io disponible (ex. tests HTTP purs)

  memberIds.forEach((userId) => {
    io.in(`user:${userId}`).socketsJoin(`conversation:${conversation.id}`);
  });
  io.to(`conversation:${conversation.id}`).emit('conversation_created', conversation);
}

function findMembership(userId, conversationId) {
  return prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
  });
}

// Modifie le nom ou la photo d'un groupe (tout membre peut le faire)
const updateConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation introuvable' });
  }
  if (!(await findMembership(req.userId, conversationId))) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }
  if (!conversation.isGroup) {
    return res
      .status(400)
      .json({ error: 'Seules les conversations de groupe peuvent être modifiées' });
  }

  const { name, avatarUrl } = req.body;
  const data = {};

  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed.length === 0 || trimmed.length > GROUP_NAME_MAX_LENGTH) {
      return res
        .status(400)
        .json({ error: 'Le nom du groupe doit contenir entre 1 et 100 caractères' });
    }
    data.name = trimmed;
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl === null || avatarUrl === '') {
      data.avatarUrl = null;
    } else if (isValidAvatarUrl(avatarUrl)) {
      data.avatarUrl = avatarUrl.trim();
    } else {
      return res.status(400).json({ error: "L'URL de la photo doit commencer par http(s)://" });
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie' });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data,
    include: MEMBERS_INCLUDE,
  });

  const io = req.app.get('io');
  if (io) io.to(`conversation:${conversationId}`).emit('conversation_updated', updated);

  res.json(updated);
});

// Supprime un groupe, réservé à son créateur. Les messages et les membres
// sont supprimés dans la même transaction, puis les membres sont prévenus.
const deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation introuvable' });
  }
  if (!(await findMembership(req.userId, conversationId))) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }
  if (!conversation.isGroup) {
    return res
      .status(400)
      .json({ error: 'Seules les conversations de groupe peuvent être supprimées' });
  }
  if (conversation.createdById !== req.userId) {
    return res.status(403).json({ error: 'Seul le créateur du groupe peut le supprimer' });
  }

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId } }),
    prisma.conversationMember.deleteMany({ where: { conversationId } }),
    prisma.conversation.delete({ where: { id: conversationId } }),
  ]);

  const io = req.app.get('io');
  if (io) {
    io.to(`conversation:${conversationId}`).emit('conversation_deleted', { id: conversationId });
    io.socketsLeave(`conversation:${conversationId}`);
  }

  res.json({ success: true });
});

// Ajoute des utilisateurs à un groupe existant (tout membre peut le faire).
// Les nouveaux membres reçoivent la conversation en temps réel.
const addMembers = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { userIds } = req.body;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation introuvable' });
  }
  if (!(await findMembership(req.userId, conversationId))) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }
  if (!conversation.isGroup) {
    return res
      .status(400)
      .json({ error: 'Seules les conversations de groupe acceptent de nouveaux membres' });
  }
  if (
    !Array.isArray(userIds) ||
    userIds.length === 0 ||
    userIds.some((id) => typeof id !== 'string' || id.trim().length === 0)
  ) {
    return res.status(400).json({ error: 'userIds requis (tableau non vide)' });
  }

  const uniqueIds = [...new Set(userIds)];
  const foundUsers = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (foundUsers.length !== uniqueIds.length) {
    return res.status(400).json({ error: 'Un ou plusieurs utilisateurs sont introuvables' });
  }

  const alreadyMembers = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { in: uniqueIds } },
    select: { userId: true },
  });
  const alreadyMemberIds = new Set(alreadyMembers.map((m) => m.userId));
  const newIds = uniqueIds.filter((id) => !alreadyMemberIds.has(id));
  if (newIds.length === 0) {
    return res.status(400).json({ error: 'Ces utilisateurs sont déjà membres du groupe' });
  }

  await prisma.conversationMember.createMany({
    data: newIds.map((userId) => ({ userId, conversationId })),
  });

  const updated = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: MEMBERS_INCLUDE,
  });

  const io = req.app.get('io');
  if (io) {
    newIds.forEach((userId) => {
      io.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
      io.in(`user:${userId}`).emit('conversation_created', updated);
    });
    io.to(`conversation:${conversationId}`).emit('conversation_updated', updated);
  }

  res.json(updated);
});

// Récupère les messages d'une conversation (avec vérification d'accès)
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!(await findMembership(req.userId, conversationId))) {
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

  if (!(await findMembership(req.userId, conversationId))) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }

  await prisma.conversationMember.update({
    where: { userId_conversationId: { userId: req.userId, conversationId: conversationId } },
    data: { lastReadAt: new Date() },
  });

  res.json({ success: true });
});

module.exports = {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  addMembers,
  getMessages,
  markAsRead,
};
