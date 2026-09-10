const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Middleware d'authentification pour les connexions Socket.io
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token manquant'));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('Token invalide'));
  }
}

function registerChatHandlers(io) {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`Utilisateur connecté: ${socket.userId}`);

    // L'utilisateur rejoint les "rooms" de toutes ses conversations
    socket.on('join_conversations', async (conversationIds) => {
      conversationIds.forEach((id) => socket.join(`conversation:${id}`));
    });

    // Envoi d'un message
    socket.on('send_message', async ({ conversationId, content }) => {
      try {
        const membership = await prisma.conversationMember.findUnique({
          where: { userId_conversationId: { userId: socket.userId, conversationId } },
        });
        if (!membership) {
          return socket.emit('error_message', { error: 'Accès refusé à cette conversation' });
        }

        const message = await prisma.message.create({
          data: { content, conversationId, senderId: socket.userId },
          include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
        });

        // Diffuse le message à tous les membres connectés de la conversation
        io.to(`conversation:${conversationId}`).emit('new_message', message);
      } catch (err) {
        console.error(err);
        socket.emit('error_message', { error: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Indicateur "en train d'écrire"
    socket.on('typing', ({ conversationId, username }) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', { username });
    });

    socket.on('disconnect', () => {
      console.log(`Utilisateur déconnecté: ${socket.userId}`);
    });
  });
}

module.exports = registerChatHandlers;
