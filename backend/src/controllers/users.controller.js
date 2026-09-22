const prisma = require('../config/db');

// Liste les autres utilisateurs (pour démarrer une nouvelle conversation)
async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    where: { id: { not: req.userId } },
    select: { id: true, username: true, avatarUrl: true },
    orderBy: { username: 'asc' },
  });

  res.json(users);
}

module.exports = { listUsers };
