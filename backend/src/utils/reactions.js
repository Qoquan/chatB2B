// Réactions autorisées sur un message. Liste fermée : le serveur ne stocke que
// ces emojis, ce qui évite d'enregistrer n'importe quel texte envoyé par un client.
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Certains emojis existent avec ou sans le « sélecteur de variante » (U+FE0F),
// par exemple ❤ et ❤️ : on le retire pour comparer, puis on stocke la forme canonique.
function normalizeEmoji(value) {
  return value.replace(/️/g, '');
}

// Renvoie la forme canonique de la réaction, ou null si elle n'est pas autorisée.
function toAllowedReaction(value) {
  if (typeof value !== 'string') return null;
  const wanted = normalizeEmoji(value.trim());
  return ALLOWED_REACTIONS.find((emoji) => normalizeEmoji(emoji) === wanted) || null;
}

module.exports = { ALLOWED_REACTIONS, toAllowedReaction };
