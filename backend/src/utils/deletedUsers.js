const prisma = require('../config/db');

const DELETED_PEER_ERROR =
  'Cet utilisateur a supprimé son compte : la conversation est en lecture seule';

// Vrai si la conversation est une discussion privée (1:1) dont l'autre membre
// a supprimé son compte. On peut encore la lire, mais plus y écrire.
// Les groupes restent utilisables par les membres restants.
async function isReadOnlyDirectConversation(conversationId) {
  const found = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      isGroup: false,
      members: { some: { user: { deletedAt: { not: null } } } },
    },
    select: { id: true },
  });
  return found !== null;
}

module.exports = { DELETED_PEER_ERROR, isReadOnlyDirectConversation };
