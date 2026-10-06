const multer = require('multer');
const { MAX_ATTACHMENT_SIZE } = require('../utils/attachments');

const MAX_SIZE_MB = MAX_ATTACHMENT_SIZE / (1024 * 1024);

// Les fichiers sont gardés en mémoire (puis enregistrés en base) : le disque
// de Render est effacé à chaque redéploiement, il ne peut pas servir de stockage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE,
    files: 1,
    fields: 5,
    fieldSize: 16 * 1024,
  },
});

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Reçoit un seul fichier (champ "file") et transforme les erreurs techniques
// de multer en erreurs HTTP claires, traitées ensuite par errorHandler (aucun
// détail interne n'est renvoyé au client).
function uploadSingleFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(httpError(413, `Fichier trop volumineux (${MAX_SIZE_MB} Mo maximum)`));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(httpError(400, 'Champ de fichier inattendu : « file » est attendu'));
      }
      return next(httpError(400, "Requête d'envoi invalide"));
    }

    console.error('[Upload]', err);
    return next(httpError(400, "Requête d'envoi invalide"));
  });
}

module.exports = { uploadSingleFile };
