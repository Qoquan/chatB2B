// Détection des messages composés uniquement d'emojis, pour les afficher en grand.
//
// Un emoji peut être composé de plusieurs caractères (ex. 👍🏽 = pouce + teinte de peau,
// ❤️ = cœur + sélecteur de variante, 👨‍👩‍👧 = plusieurs personnes collées par des « ZWJ »,
// 🇫🇷 = deux lettres drapeau). L'expression régulière ci-dessous les reconnaît en un seul bloc.
// Les symboles texte © ® ™ sont exclus : ce ne sont pas de « vrais » emojis à agrandir.
const EMOJI_PATTERN =
  '(?![\\u00A9\\u00AE\\u2122])\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})*' +
  '(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})*)*' +
  '|\\p{Regional_Indicator}{2}';

// Si le texte ne contient QUE des emojis (et éventuellement des espaces), renvoie la liste
// de ces emojis, dans l'ordre. Sinon renvoie null (message normal, affiché à taille standard).
export function getEmojiOnly(text) {
  const regex = new RegExp(EMOJI_PATTERN, 'gu');
  const emojis = text.match(regex);
  if (!emojis) return null;
  if (text.replace(regex, '').trim() !== '') return null;
  return emojis;
}

// Découpe une liste en rangées de `size` éléments : [a, b, c, d, e] -> [[a, b], [c, d], [e]]
export function chunk(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
