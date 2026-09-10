require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const registerChatHandlers = require('./sockets/chat.socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Route de santé (utile pour vérifier que le service Render est réveillé)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationsRoutes);

registerChatHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur ChatB2B démarré sur le port ${PORT}`);
});
