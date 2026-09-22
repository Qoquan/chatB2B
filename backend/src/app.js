// Application Express seule (sans serveur HTTP ni Socket.io), pour pouvoir
// être importée directement par les tests (supertest) sans ouvrir de port
// réseau. Le serveur HTTP + Socket.io est assemblé dans server.js.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { corsOptionsDelegate } = require('./config/cors');

const app = express();

app.use(cors({ origin: corsOptionsDelegate }));
app.use(express.json());

// Route de santé (utile pour vérifier que le service Render est réveillé)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationsRoutes);

// 404 pour toute route inconnue (doit venir après toutes les routes)
app.use(notFoundHandler);

// Handler d'erreurs centralisé (doit être le tout dernier middleware) :
// jamais de stack trace envoyée au client, toujours un message JSON clair.
app.use(errorHandler);

module.exports = app;
