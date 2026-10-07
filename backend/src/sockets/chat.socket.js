const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { sanitizeText } = require('../utils/validators');
const { DELETED_PEER_ERROR, isReadOnlyDirectConversation } = require('../utils/deletedUsers');

// Middleware d'authentification pour les connexions Socket.io
async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token manquant'));

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new Error('Token invalide'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { deletedAt: true },
    });
    if (!user || user.deletedAt) return next(new Error('Compte introuvable ou supprimé'));
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('Erreur interne'));
  }
}

function registerChatHandlers(io) {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`Utilisateur connecté: ${socket.userId}`);

    // Room personnelle : permet de cibler cet utilisateur précis (toutes ses
    // connexions/onglets) depuis n'importe où dans le code, notamment depuis
    // les routes REST classiques (ex. création de conversation), sans avoir
    // besoin de connaître son socket.id.
    socket.join(`user:${socket.userId}`);

    // L'utilisateur rejoint les "rooms" de toutes ses conversations
    socket.on('join_conversations', async (conversationIds) => {
      if (!Array.isArray(conversationIds)) return;
      conversationIds
        .filter((id) => typeof id === 'string' && id.trim().length > 0)
        .forEach((id) => socket.join(`conversation:${id}`));
    });

    // Envoi d'un message
    socket.on('send_message', async ({ conversationId, content }) => {
      try {
        if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
          return socket.emit('error_message', { error: 'Conversation invalide' });
        }

        const cleanContent = sanitizeText(content);
        if (!cleanContent) {
          return socket.emit('error_message', { error: 'Le message ne peut pas être vide' });
        }

        const membership = await prisma.conversationMember.findUnique({
          where: { userId_conversationId: { userId: socket.userId, conversationId } },
        });
        if (!membership) {
          return socket.emit('error_message', { error: 'Accès refusé à cette conversation' });
        }
        if (await isReadOnlyDirectConversation(conversationId)) {
          return socket.emit('error_message', { error: DELETED_PEER_ERROR });
        }

        const message = await prisma.message.create({
          data: { content: cleanContent, conversationId, senderId: socket.userId },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true, deletedAt: true } },
          },
        });

        // Diffuse le message à tous les membres connectés de la conversation
        io.to(`conversation:${conversationId}`).emit('new_message', message);
      } catch (err) {
        console.error(err);
        socket.emit('error_message', { error: "Erreur lors de l'envoi du message" });
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
