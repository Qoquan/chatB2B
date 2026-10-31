const { rateLimit } = require('express-rate-limit');

// Freine les essais de mots de passe en série depuis une même adresse IP. Seuls
// les échecs comptent : un utilisateur qui se connecte normalement n'est pas gêné.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

module.exports = { loginLimiter };
