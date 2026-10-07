const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  try {
    // Un compte supprimé garde un token techniquement valide jusqu'à son
    // expiration : on vérifie donc en base que le compte existe toujours.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return res.status(401).json({ error: 'Compte introuvable ou supprimé' });
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
