// Jeu de données de démonstration : une petite entreprise avec un groupe, des
// conversations privées, une pièce jointe, des réactions et des messages non lus.
//
// Lancement : npm run db:seed
//
// Les comptes créés ont un mot de passe public : le script refuse donc de
// s'exécuter en production ou sur une base distante. Pour une base distante de
// développement (branche Neon par exemple) : ALLOW_REMOTE_SEED=true npm run db:seed

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const DEMO_PASSWORD = 'demo1234';
const DEMO_EMAIL_DOMAIN = 'demo.chatb2b.local';
const PLANNING_CSV = Buffer.from('jour,tache\nlundi,relecture\njeudi,demo client\n');
const USERNAMES = ['claire.martin', 'thomas.leroy', 'sophie.dubois', 'marc.petit', 'julie.bernard'];

function assertSafeDatabase() {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed refusé : NODE_ENV vaut "production".');
  }
  if (!isLocal && process.env.ALLOW_REMOTE_SEED !== 'true') {
    throw new Error('Seed refusé : la base n’est pas locale (voir ALLOW_REMOTE_SEED).');
  }
}

// Date située `minutes` avant maintenant, pour un historique réaliste
function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function createDirectConversation(prisma, firstUser, secondUser) {
  return prisma.conversation.create({
    data: { members: { create: [{ userId: firstUser.id }, { userId: secondUser.id }] } },
  });
}

async function main() {
  require('dotenv').config();
  assertSafeDatabase();

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.count({
      where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    });
    if (existing > 0) {
      console.log('Données de démonstration déjà présentes : rien à faire.');
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const [claire, thomas, sophie, marc, julie] = await Promise.all(
      USERNAMES.map((username) =>
        prisma.user.create({
          data: {
            username,
            email: `${username.replace('.', '')}@${DEMO_EMAIL_DOMAIN}`,
            passwordHash,
          },
        })
      )
    );

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        name: 'Équipe Produit',
        createdById: claire.id,
        members: {
          create: [claire, thomas, sophie, marc].map((user) => ({
            userId: user.id,
            lastReadAt: user.id === claire.id ? minutesAgo(20) : new Date(),
          })),
        },
      },
    });

    const groupMessages = [
      [claire, 'Bonjour à tous, point rapide sur la version de vendredi.', 180],
      [thomas, 'Les tests sont au vert, il reste la page de tarifs à relire.', 170],
      [sophie, 'Je m’en occupe ce matin.', 165],
      [marc, 'Parfait, merci !', 160],
      [sophie, 'Tarifs relus : deux corrections, c’est en ligne.', 45],
      [thomas, 'Je prépare la démo client pour jeudi.', 10],
    ];
    const created = [];
    for (const [sender, content, age] of groupMessages) {
      created.push(
        await prisma.message.create({
          data: {
            content,
            conversationId: group.id,
            senderId: sender.id,
            createdAt: minutesAgo(age),
          },
        })
      );
    }

    await prisma.reaction.createMany({
      data: [
        { messageId: created[1].id, userId: claire.id, emoji: '👍' },
        { messageId: created[1].id, userId: marc.id, emoji: '👍' },
        { messageId: created[4].id, userId: claire.id, emoji: '❤️' },
      ],
    });

    await prisma.message.create({
      data: {
        content: 'Le planning de la semaine.',
        conversationId: group.id,
        senderId: marc.id,
        createdAt: minutesAgo(5),
        attachment: {
          create: {
            fileName: 'planning.csv',
            mimeType: 'text/csv',
            size: PLANNING_CSV.length,
            data: PLANNING_CSV,
          },
        },
      },
    });

    const withThomas = await createDirectConversation(prisma, claire, thomas);
    await prisma.message.createMany({
      data: [
        {
          conversationId: withThomas.id,
          senderId: claire.id,
          content: 'Tu as avancé sur la démo ?',
          createdAt: minutesAgo(90),
        },
        {
          conversationId: withThomas.id,
          senderId: thomas.id,
          content: 'Oui, elle sera prête pour jeudi.',
          createdAt: minutesAgo(85),
        },
      ],
    });

    const withJulie = await createDirectConversation(prisma, claire, julie);
    await prisma.message.create({
      data: {
        conversationId: withJulie.id,
        senderId: julie.id,
        content: 'Je t’envoie le contrat signé demain matin.',
        createdAt: minutesAgo(30),
      },
    });

    console.log(`${USERNAMES.length} comptes créés, par exemple clairemartin@${DEMO_EMAIL_DOMAIN}`);
    console.log(`Mot de passe de démonstration : ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
