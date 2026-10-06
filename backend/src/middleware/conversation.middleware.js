const prisma = require('../config/db');
const { asyncHandler } = require('./error.middleware');

// Vérifie que l'utilisateur connecté est membre de la conversation visée
// (req.params.conversationId) AVANT toute autre opération. Placé devant le
// parseur d'upload, il évite qu'un non-membre fasse charger un fichier de
// plusieurs Mo en mémoire sur le serveur.
const requireConversationMember = asyncHandler(async (req, res, next) => {
  const { conversationId } = req.params;

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: req.userId, conversationId: conversationId } },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Accès refusé à cette conversation' });
  }

  next();
});

module.exports = { requireConversationMember };
