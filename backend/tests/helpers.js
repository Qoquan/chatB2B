// Utilitaires partagés par les tests d'intégration : génère des identités
// de test uniques (évite les collisions entre runs / entre fichiers de
// test) et nettoie proprement les données créées après chaque suite, dans
// le bon ordre (Message -> ConversationMember -> Conversation -> User) car
// le schéma Prisma n'a pas de suppression en cascade.

import prisma from '../src/config/db.js';

let counter = 0;

function uniqueUser(label) {
  counter += 1;
  const suffix = `${Date.now()}_${process.pid}_${counter}`;
  return {
    email: `${label}_${suffix}@test.chatb2b.local`,
    username: `${label}_${suffix}`.slice(0, 30),
    password: 'motdepasse123',
  };
}

async function cleanupTestData({ userIds = [], conversationIds = [] } = {}) {
  if (conversationIds.length > 0) {
    await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await prisma.conversationMember.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
  }
  if (userIds.length > 0) {
    // Sécurité supplémentaire : au cas où un message/membership existerait
    // hors des conversations déjà nettoyées ci-dessus.
    await prisma.message.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.conversationMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

export { uniqueUser, cleanupTestData, prisma };
