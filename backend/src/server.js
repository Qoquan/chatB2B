// Assemble le serveur HTTP + Socket.io autour de l'app Express (app.js).
// Séparé de index.js pour pouvoir être démarré sur un port éphémère (port 0)
// par les tests d'intégration temps réel, sans dupliquer la configuration.

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const registerChatHandlers = require('./sockets/chat.socket');
const { isOriginAllowed } = require('./config/cors');

function createServer() {
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS_NOT_ALLOWED'));
        }
      },
      methods: ['GET', 'POST'],
    },
  });

  // Rend l'instance io accessible depuis les routes REST (req.app.get('io')),
  // pour pouvoir notifier des utilisateurs en temps réel depuis un
  // controller classique (ex. prévenir les membres invités quand une
  // nouvelle conversation est créée).
  app.set('io', io);

  registerChatHandlers(io);

  return { app, server, io };
}

module.exports = { createServer };
