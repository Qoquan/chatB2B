// Liste blanche des origines autorisées (exigence cahier des charges,
// section 7 : "origines CORS strictes", pas de wildcard "*" en production).
//
// FRONTEND_URL : URL de production du frontend (ex. Render static site).
// ALLOWED_ORIGINS : liste additionnelle séparée par des virgules, utile en
// dev local (ex. "http://localhost:5173,http://localhost:3000") et en CI.
//
// Centralisé ici pour être partagé par Express (app.js) et Socket.io
// (server.js), qui doivent appliquer exactement la même règle.

const allowedOrigins = [process.env.FRONTEND_URL, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
  .map((origin) => (origin || '').trim())
  .filter((origin) => origin.length > 0);

function isOriginAllowed(origin) {
  // Pas d'en-tête Origin (ex. curl, health checks, requêtes serveur à
  // serveur, tests) : on autorise, il n'y a pas de navigateur à protéger ici.
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

// Delegate compatible avec le package `cors`
function corsOptionsDelegate(origin, callback) {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error('CORS_NOT_ALLOWED'));
  }
}

module.exports = { allowedOrigins, isOriginAllowed, corsOptionsDelegate };
