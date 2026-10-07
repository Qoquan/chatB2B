const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');

const PROFILE_FIELDS = { id: true, email: true, username: true, avatarUrl: true };

// Liste les autres utilisateurs (pour démarrer une nouvelle conversation)
async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    where: { id: { not: req.userId }, deletedAt: null },
    select: { id: true, username: true, avatarUrl: true },
    orderBy: { username: 'asc' },
  });

  res.json(users);
}

const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: PROFILE_FIELDS,
  });
  res.json(user);
});

const updateMe = asyncHandler(async (req, res) => {
  const { username, avatarUrl } = req.body;
  const data = {};

  if (username !== undefined) {
    const trimmed = typeof username === 'string' ? username.trim() : '';
    if (trimmed.length < 3 || trimmed.length > 30) {
      return res
        .status(400)
        .json({ error: "Le nom d'utilisateur doit contenir entre 3 et 30 caractères." });
    }
    data.username = trimmed;
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl === null || avatarUrl === '') {
      data.avatarUrl = null;
    } else {
      const trimmed = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
      if (trimmed.length > 500 || !/^https?:\/\//i.test(trimmed)) {
        return res.status(400).json({ error: "L'URL de l'avatar doit commencer par http(s)://." });
      }
      data.avatarUrl = trimmed;
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie' });
  }

  if (data.username) {
    const taken = await prisma.user.findFirst({
      where: { username: data.username, NOT: { id: req.userId } },
    });
    if (taken) {
      return res.status(409).json({ error: "Nom d'utilisateur déjà utilisé" });
    }
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: PROFILE_FIELDS,
  });
  res.json(user);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel requis' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(403).json({ error: 'Mot de passe actuel incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });

  res.json({ success: true });
});

// Suppression définitive du compte (droit à l'effacement, RGPD art. 17) :
// messages, appartenances et compte sont supprimés. Les conversations qui
// n'ont plus aucun membre sont supprimées avec leurs messages.
const deleteMe = asyncHandler(async (req, res) => {
  const { currentPassword } = req.body;

  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ error: 'Mot de passe requis pour supprimer le compte' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(403).json({ error: 'Mot de passe incorrect' });
  }

  // Anonymisation plutôt que suppression : les messages et les fichiers envoyés
  // restent lisibles par les autres membres, mais toutes les données
  // personnelles du compte (e-mail, pseudo, photo, mot de passe) sont effacées.
  // L'auteur apparaît alors comme « Utilisateur supprimé » (champ deletedAt).
  await prisma.$transaction(async (tx) => {
    const memberships = await tx.conversationMember.findMany({
      where: { userId: req.userId },
      select: { conversationId: true },
    });
    const conversationIds = memberships.map((m) => m.conversationId);

    await tx.user.update({
      where: { id: req.userId },
      data: {
        email: `deleted_${req.userId}@deleted.invalid`,
        username: `deleted_${req.userId.replace(/-/g, '').slice(0, 8)}`,
        // Valeur aléatoire qui n'est pas un hash valide : aucune connexion possible.
        passwordHash: crypto.randomBytes(32).toString('hex'),
        avatarUrl: null,
        deletedAt: new Date(),
      },
    });

    // Une conversation où il ne reste plus aucun compte actif n'intéresse plus
    // personne : on l'efface réellement, avec ses messages et ses fichiers.
    const abandoned = await tx.conversation.findMany({
      where: { id: { in: conversationIds }, members: { none: { user: { deletedAt: null } } } },
      select: { id: true },
    });
    const abandonedIds = abandoned.map((c) => c.id);
    await tx.attachment.deleteMany({
      where: { message: { conversationId: { in: abandonedIds } } },
    });
    await tx.message.deleteMany({ where: { conversationId: { in: abandonedIds } } });
    await tx.conversationMember.deleteMany({ where: { conversationId: { in: abandonedIds } } });
    await tx.conversation.deleteMany({ where: { id: { in: abandonedIds } } });

    // Un groupe créé par ce compte passe au plus ancien membre encore actif,
    // pour qu'il reste administrable (renommer, supprimer).
    const ownedGroups = await tx.conversation.findMany({
      where: { createdById: req.userId, id: { notIn: abandonedIds } },
      select: { id: true },
    });
    for (const group of ownedGroups) {
      const heir = await tx.conversationMember.findFirst({
        where: { conversationId: group.id, user: { deletedAt: null } },
        orderBy: { joinedAt: 'asc' },
        select: { userId: true },
      });
      if (heir) {
        await tx.conversation.update({
          where: { id: group.id },
          data: { createdById: heir.userId },
        });
      }
    }
  });

  const io = req.app.get('io');
  if (io) io.in(`user:${req.userId}`).disconnectSockets(true);

  res.json({ success: true });
});

module.exports = { listUsers, getMe, updateMe, changePassword, deleteMe };
