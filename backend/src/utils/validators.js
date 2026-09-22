// Validation des entrées utilisateur (cahier des charges, section 7 :
// "les entrées utilisateur sont validées et échappées").
// Volontairement sans dépendance externe (pas de Joi/Zod) pour rester
// simple à comprendre et à justifier dans le rapport.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Retourne un tableau de messages d'erreur (vide si tout est valide)
function validateRegisterInput({ email, username, password }) {
  const errors = [];

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push("L'adresse email n'est pas valide.");
  }
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push("Le nom d'utilisateur doit contenir au moins 3 caractères.");
  }
  if (username && username.trim().length > 30) {
    errors.push("Le nom d'utilisateur ne peut pas dépasser 30 caractères.");
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères.');
  }

  return errors;
}

function validateLoginInput({ email, password }) {
  const errors = [];
  if (!email || typeof email !== 'string') errors.push('Email requis.');
  if (!password || typeof password !== 'string') errors.push('Mot de passe requis.');
  return errors;
}

// Nettoie une chaîne libre (ex. contenu de message) : retire les espaces
// superflus. L'échappement HTML n'est pas nécessaire côté API JSON — React
// échappe déjà tout texte affiché — mais on rejette les valeurs vides.
function sanitizeText(value, { maxLength = 5000 } = {}) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

module.exports = { validateRegisterInput, validateLoginInput, sanitizeText, EMAIL_REGEX };
