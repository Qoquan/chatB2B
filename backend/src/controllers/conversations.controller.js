const prisma = require('../config/db');

// Liste les conversations de l'utilisateur connecté, avec dernier message
// et compteur de messages non lus (pour badge/notification)
async function listConversations(req, res) {
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
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: req.userId },
          createdAt: myMembership?.lastReadAt ? { gt: myMembership.lastReadAt } : undefined,
        },
      });
      return { ...conv, unreadCount };
    })
  );

  res.json(withUnreadCount);
}

// Crée une conversation privée (1:1) ou de groupe.
// Pour une conversation 1:1, réutilise une conversation existante entre les
// deux mêmes utilisateurs plutôt que d'en créer une nouvelle à chaque fois.
async function createConversation(req, res) {
  const { memberIds, isGroup, name } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds requis (tableau non vide)' });
  }
  if (isGroup && !name) {
    return res.status(400).json({ error: 'Un nom est requis pour une conversation de groupe' });
  }

  const allMemberIds = [...new Set([...memberIds, req.userId])];

  if (!isGroup && allMemberIds.length === 2) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: allMemberIds.map((userId) => ({
          members: { some: { userId } },
        })),
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } }