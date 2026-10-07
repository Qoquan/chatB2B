// Nom à afficher pour un utilisateur : un compte supprimé est anonymisé côté
// serveur (deletedAt renseigné) et s'affiche toujours « Utilisateur supprimé ».
export const DELETED_USER_LABEL = 'Utilisateur supprimé';

export function isDeletedUser(user) {
  return Boolean(user?.deletedAt);
}

export function getUserName(user) {
  return isDeletedUser(user) ? DELETED_USER_LABEL : user?.username;
}
