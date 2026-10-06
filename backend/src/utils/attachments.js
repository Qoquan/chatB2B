// Règles de validation des pièces jointes (cahier des charges, section 7 :
// "les entrées utilisateur sont validées"). Aucune dépendance externe : on
// vérifie à la fois le type annoncé par le navigateur, l'extension du nom de
// fichier ET la "signature" réelle du contenu (les premiers octets), car le
// type annoncé par le client peut être falsifié trivialement.

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 Mo
const MAX_FILE_NAME_LENGTH = 120;
const MAX_CAPTION_LENGTH = 5000;

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" (docx, xlsx, pptx)

// type MIME autorisé -> extensions acceptées, affichage direct dans la bulle
// (images) ou téléchargement, et contrôle de signature.
// Volontairement sans SVG (peut contenir du JavaScript) ni HTML.
const ALLOWED_TYPES = {
  'image/png': { extensions: ['png'], inline: true, signature: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], inline: true, signature: [0xff, 0xd8, 0xff] },
  'image/gif': { extensions: ['gif'], inline: true, signature: [0x47, 0x49, 0x46, 0x38] },
  'image/webp': { extensions: ['webp'], inline: true, signature: 'webp' },
  'application/pdf': { extensions: ['pdf'], inline: false, signature: [0x25, 0x50, 0x44, 0x46] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
    inline: false,
    signature: ZIP_SIGNATURE,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['xlsx'],
    inline: false,
    signature: ZIP_SIGNATURE,
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    extensions: ['pptx'],
    inline: false,
    signature: ZIP_SIGNATURE,
  },
  'text/plain': { extensions: ['txt'], inline: false, signature: 'text' },
  'text/csv': { extensions: ['csv'], inline: false, signature: 'text' },
};

function startsWith(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, i) => buffer[i] === byte);
}

function matchesSignature(buffer, signature) {
  if (Array.isArray(signature)) return startsWith(buffer, signature);
  if (signature === 'webp') {
    // "RIFF" + 4 octets de taille + "WEBP"
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  if (signature === 'text') {
    // Un fichier texte ne contient jamais d'octet nul : permet de refuser un
    // binaire déguisé en .txt / .csv.
    return !buffer.subarray(0, 8000).includes(0);
  }
  return false;
}

function getExtension(fileName) {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

// Nettoie le nom de fichier fourni par le client : retire tout chemin, les
// caractères de contrôle, et limite la longueur (en gardant l'extension).
function sanitizeFileName(rawName) {
  let name = typeof rawName === 'string' ? rawName : '';

  // Le navigateur envoie l'UTF-8, mais le parseur multipart le relit en
  // latin1 ("Ã©" au lieu de "é") : on répare ce cas, et uniquement s'il est
  // reconnu sans ambiguïté (sinon on garde le nom tel quel).
  const repaired = Buffer.from(name, 'latin1').toString('utf8');
  if (!repaired.includes('�') && repaired !== name) name = repaired;

  // Retire tout chemin, puis les caractères de contrôle (codes 0-31 et 127)
  const baseName = name.split(/[\\/]/).pop();
  name = Array.from(baseName)
    .filter((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length > MAX_FILE_NAME_LENGTH) {
    const extension = getExtension(name);
    const suffix = extension ? `.${extension}` : '';
    name = name.slice(0, MAX_FILE_NAME_LENGTH - suffix.length) + suffix;
  }

  return name || 'fichier';
}

function isInlineImage(mimeType) {
  return Boolean(ALLOWED_TYPES[mimeType] && ALLOWED_TYPES[mimeType].inline);
}

// Retourne un message d'erreur (string) si le fichier est refusé, ou null s'il
// est valide. `file` = objet fourni par multer ({ buffer, mimetype, originalname }).
function validateAttachmentFile(file) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    return 'Le fichier est vide.';
  }

  const rule = ALLOWED_TYPES[file.mimetype];
  if (!rule) {
    return 'Type de fichier non autorisé (images, PDF, Word, Excel, PowerPoint, texte ou CSV).';
  }

  const extension = getExtension(sanitizeFileName(file.originalname));
  if (!rule.extensions.includes(extension)) {
    return "L'extension du fichier ne correspond pas à son type.";
  }

  if (!matchesSignature(file.buffer, rule.signature)) {
    return 'Le contenu du fichier ne correspond pas à son type.';
  }

  return null;
}

// En-tête Content-Disposition sûr pour un nom de fichier quelconque : une
// version ASCII de secours + la version UTF-8 (RFC 5987) pour les accents.
function buildContentDisposition(fileName, inline) {
  const asciiFallback = fileName.replace(/[^A-Za-z0-9._ -]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  const disposition = inline ? 'inline' : 'attachment';
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

module.exports = {
  MAX_ATTACHMENT_SIZE,
  MAX_CAPTION_LENGTH,
  ALLOWED_TYPES,
  sanitizeFileName,
  isInlineImage,
  validateAttachmentFile,
  buildContentDisposition,
};
