// Tests d'intégration des réactions (emojis) sur les messages : ajout / retrait,
// droits d'accès, validation, historique, diffusion temps réel, et nettoyage
// à la suppression d'un groupe ou d'un compte.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../src/server.js';
import { uniqueUser, cleanupTestData, prisma } from './helpers.js';

const createdUserIds = [];
const createdConversationIds = [];
const PASSWORD = 'motdepasse123';

let app;
let server;
let baseUrl;
let alice;
let bob;
let carol;
let conversationId; // alice + bob
let otherConversationId; // alice + carol
let messageId; // message de bob dans la conversation alice + bob

function auth(user) {
  return { Authorization: `Bearer ${user.token}` };
}

function react(user, convId, msgId, emoji) {
  return request(app)
    .post(`/api/conversations/${convId}/messages/${msgId}/reactions`)
    .set(auth(user))
    .send({ emoji });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout en attendant "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

async function registerUser(label) {
  const credentials = uniqueUser(label);
  const res = await request(app).post('/api/auth/register').send(credentials);
  const user = { id: res.body.user.id, token: res.body.token };
  createdUserIds.push(user.id);
  return user;
}

async function createConversation(creator, body) {
  const res = await request(app).post('/api/conversations').set(auth(creator)).send(body);
  createdConversationIds.push(res.body.id);
  return res.body.id;
}

async function createMessage(convId, sender, content = 'Salut !') {
  const message = await prisma.message.create({
    data: { content, conversationId: convId, senderId: sender.id },
  });
  return message.id;
}

beforeAll(async () => {
  ({ app, server } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  alice = await registerUser('rea_alice');
  bob = await registerUser('rea_bob');
  carol = await registerUser('rea_carol');

  conversationId = await createConversation(alice, { memberIds: [bob.id] });
  otherConversationId = await createConversation(alice, { memberIds: [carol.id] });
  messageId = await createMessage(conversationId, bob);
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds, conversationIds: createdConversationIds });
  await new Promise((resolve) => server.close(resolve));
});

describe('POST /api/conversations/:id/messages/:id/reactions — droits et validation', () => {
  it('refuse une requête sans token (401)', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages/${messageId}/reactions`)
      .send({ emoji: '👍' });
    expect(res.status).toBe(401);
  });

  it("refuse un utilisateur qui n'est pas membre de la conversation (403)", async () => {
    const res = await react(carol, conversationId, messageId, '👍');
    expect(res.status).toBe(403);
  });

  it('refuse un emoji hors de la liste autorisée (400)', async () => {
    const res = await react(alice, conversationId, messageId, '💣');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non autorisée/i);
  });

  it('refuse une réaction sans emoji ou avec un type invalide (400)', async () => {
    const missing = await request(app)
      .post(`/api/conversations/${conversationId}/messages/${messageId}/reactions`)
      .set(auth(alice))
      .send({});
    expect(missing.status).toBe(400);
    const wrongType = await react(alice, conversationId, messageId, 42);
    expect(wrongType.status).toBe(400);
  });

  it("refuse un message qui n'existe pas (404)", async () => {
    const res = await react(alice, conversationId, '00000000-0000-0000-0000-000000000000', '👍');
    expect(res.status).toBe(404);
  });

  it("refuse un message d'une autre conversation, même pour un membre des deux (404)", async () => {
    // Alice est membre des deux conversations, mais le message appartient à la première.
    const res = await react(alice, otherConversationId, messageId, '👍');
    expect(res.status).toBe(404);
  });
});

describe('Réactions — ajout, retrait et historique', () => {
  it('ajoute une réaction puis la retire au second clic (200)', async () => {
    const added = await react(alice, conversationId, messageId, '👍');
    expect(added.status).toBe(200);
    expect(added.body.added).toBe(true);
    expect(added.body.reactions).toEqual([{ emoji: '👍', userId: alice.id }]);

    const removed = await react(alice, conversationId, messageId, '👍');
    expect(removed.status).toBe(200);
    expect(removed.body.added).toBe(false);
    expect(removed.body.reactions).toEqual([]);
  });

  it('accepte plusieurs utilisateurs et plusieurs emojis sur un même message', async () => {
    await react(alice, conversationId, messageId, '❤️');
    await react(bob, conversationId, messageId, '❤️');
    const res = await react(alice, conversationId, messageId, '😂');

    expect(res.body.reactions).toHaveLength(3);
    const hearts = res.body.reactions.filter((r) => r.emoji === '❤️');
    expect(hearts.map((r) => r.userId).sort()).toEqual([alice.id, bob.id].sort());
    expect(res.body.reactions.some((r) => r.emoji === '😂' && r.userId === alice.id)).toBe(true);
  });

  it('reconnaît un emoji sans sélecteur de variante (❤ au lieu de ❤️) sans doublon', async () => {
    // Alice a déjà posé ❤️ au test précédent : ❤ (sans U+FE0F) est le même emoji, donc il la retire.
    const res = await react(alice, conversationId, messageId, '❤');
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(false);
    expect(res.body.reactions.filter((r) => r.emoji === '❤️')).toHaveLength(1);
  });

  it("l'historique des messages contient les réactions", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice));
    expect(res.status).toBe(200);
    const message = res.body.find((m) => m.id === messageId);
    expect(message.reactions.length).toBeGreaterThan(0);
    expect(message.reactions[0]).toHaveProperty('emoji');
    expect(message.reactions[0]).toHaveProperty('userId');
  });
});

describe('Réactions — temps réel', () => {
  it('diffuse reaction_updated aux autres membres connectés', async () => {
    const bobSocket = ioClient(baseUrl, { auth: { token: bob.token }, transports: ['websocket'] });

    try {
      await waitForConnect(bobSocket);
      bobSocket.emit('join_conversations', [conversationId]);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const received = waitForEvent(bobSocket, 'reaction_updated');
      await react(alice, conversationId, messageId, '🙏');

      const payload = await received;
      expect(payload.conversationId).toBe(conversationId);
      expect(payload.messageId).toBe(messageId);
      expect(payload.reactions.some((r) => r.emoji === '🙏' && r.userId === alice.id)).toBe(true);
    } finally {
      bobSocket.disconnect();
    }
  });
});

describe('Réactions — suppression de groupe et de compte', () => {
  it("la suppression d'un groupe efface aussi les réactions de ses messages (200)", async () => {
    const dave = await registerUser('rea_dave');
    const groupId = await createConversation(alice, {
      memberIds: [dave.id],
      isGroup: true,
      name: 'Groupe réactions',
    });
    const groupMessageId = await createMessage(groupId, dave);
    expect((await react(alice, groupId, groupMessageId, '👍')).status).toBe(200);

    const res = await request(app).delete(`/api/conversations/${groupId}`).set(auth(alice));
    expect(res.status).toBe(200);
    expect(await prisma.reaction.count({ where: { messageId: groupMessageId } })).toBe(0);
  });

  it("la suppression d'un compte retire ses réactions mais garde celles des autres", async () => {
    const erin = await registerUser('rea_erin');
    const frank = await registerUser('rea_frank');
    const convId = await createConversation(erin, { memberIds: [frank.id] });
    const msgId = await createMessage(convId, frank);

    expect((await react(erin, convId, msgId, '👍')).status).toBe(200);
    expect((await react(frank, convId, msgId, '❤️')).status).toBe(200);

    const del = await request(app)
      .delete('/api/users/me')
      .set(auth(erin))
      .send({ currentPassword: PASSWORD });
    expect(del.status).toBe(200);

    const remaining = await prisma.reaction.findMany({ where: { messageId: msgId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(frank.id);
  });

  it('refuse de réagir dans une discussion privée en lecture seule (403)', async () => {
    const gina = await registerUser('rea_gina');
    const hugo = await registerUser('rea_hugo');
    const convId = await createConversation(gina, { memberIds: [hugo.id] });
    const msgId = await createMessage(convId, hugo);

    const del = await request(app)
      .delete('/api/users/me')
      .set(auth(gina))
      .send({ currentPassword: PASSWORD });
    expect(del.status).toBe(200);

    const res = await react(hugo, convId, msgId, '👍');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/supprimé/i);
  });
});
