const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');

const PROFILE_FIELDS = { id: true, email: true, username: true, avatarUrl: true };

// Liste les autres utilisateurs (pour démarrer une nouvelle conversation)
async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    where: { id: { not: req.userId } },
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

module.exports = { listUsers, getMe, updateMe, changePassword };
