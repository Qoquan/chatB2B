// Gestion centralisée des erreurs.
//
// Objectif (exigence du cahier des charges, section 7) : jamais de stack
// trace ni de détail technique renvoyé au client, mais des messages clairs
// et une trace complète conservée côté serveur (logs Render) pour le debug.

// Enveloppe un handler async pour que toute erreur (rejet de promesse,
// exception Prisma, etc.) soit automatiquement transmise à errorHandler
// au lieu de rester une "unhandled promise rejection" silencieuse.
// Express 4 ne capture pas nativement les erreurs async : sans ce wrapper,
// une erreur dans un controller (ex. panne temporaire de la base de
// données) fait planter ou bloquer la requête sans réponse au client.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 : aucune route ne correspond
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.originalUrl}` });
}

// Handler final : toute erreur non gérée explicitement passe par ici.
// Il ne doit JAMAIS renvoyer err.stack ni err.message brut d'une erreur
// interne (SQL, Prisma, etc.) au client — seulement un message générique.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[Erreur non gérée]', err);

  // Corps JSON malformé envoyé par le client (express.json() lève une
  // SyntaxError avec err.type === 'entity.parse.failed')
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Corps de requête JSON invalide' });
  }

  // Erreur CORS levée explicitement dans index.js
  if (err.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  // Violation de contrainte unique Prisma (ex. email déjà utilisé, non
  // intercepté explicitement en amont dans un controller)
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Cette valeur est déjà utilisée' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Erreur interne du serveur' : err.message || 'Erreur';
  res.status(status).json({ error: message });
}

module.exports = { asyncHandler, notFoundHandler, errorHandler };
