// Cloisonnement des rooms Socket.io, reconnexion, historique paginé, gestion des
// groupes et limitation des tentatives de connexion.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../src/server.js';
import prisma from '../src/config/db.js';
import { uniqueUser, cleanupTestData } from './helpers.js';

const createdUserIds = [];
const createdConversationIds = [];

let server;
let app;
let baseUrl;
let alice;
let bob;
let carol;
let outsider;
let conversationId;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function registerUser(label) {
  const user = uniqueUser(label);
  const res = await request(app).post('/api/auth/register').send(user);
  createdUserIds.push(res.body.user.id);
  return { ...user, id: res.body.user.id, token: res.body.token };
}

function connectClient(token) {
  const socket = ioClient(baseUrl, { auth: { token }, transports: ['websocket'] });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function collect(socket, event) {
  const received = [];
  socket.on(event, (payload) => received.push(payload));
  return received;
}

function authed(method, url, user) {
  return request(app)[method](url).set('Authorization', `Bearer ${user.token}`);
}

beforeAll(async () => {
  ({ app, server } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  alice = await registerUser('sec_alice');
  bob = await registerUser('sec_bob');
  carol = await registerUser('sec_carol');
  outsider = await registerUser('sec_outsider');

  const res = await authed('post', '/api/conversations', alice).send({ memberIds: [bob.id] });
  conversationId = res.body.id;
  createdConversationIds.push(conversationId);
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds, conversationIds: createdConversationIds });
  await new Promise((resolve) => server.close(resolve));
});

describe('Socket.io — cloisonnement des conversations', () => {
  it('ne transmet ni message ni frappe à un non-membre qui demande la room', async () => {
    const aliceSocket = await connectClient(alice.token);
    const outsiderSocket = await connectClient(outsider.token);

    try {
      const messages = collect(outsiderSocket, 'new_message');
      const typing = collect(outsiderSocket, 'user_typing');

      outsiderSocket.emit('join_conversations', [conversationId]);
      await sleep(250);

      aliceSocket.emit('typing', { conversationId, username: 'alice' });
      aliceSocket.emit('send_message', { conversationId, content: 'Message confidentiel' });
      await sleep(400);

      expect(messages).toHaveLength(0);
      expect(typing).toHaveLength(0);
    } finally {
      aliceSocket.disconnect();
      outsiderSocket.disconnect();
    }
  });

  it("n'autorise pas un non-membre à diffuser l'indicateur de frappe", async () => {
    const bobSocket = await connectClient(bob.token);
    const outsiderSocket = await connectClient(outsider.token);

    try {
      await sleep(200);
      const typing = collect(bobSocket, 'user_typing');

      outsiderSocket.emit('typing', { conversationId, username: 'intrus' });
      await sleep(300);

      expect(typing).toHaveLength(0);
    } finally {
      bobSocket.disconnect();
      outsiderSocket.disconnect();
    }
  });

  it('rejoint ses conversations dès la connexion, donc aussi après une reconnexion', async () => {
    const aliceSocket = await connectClient(alice.token);
    const bobSocket = await connectClient(bob.token);

    try {
      await sleep(250);
      const messages = collect(bobSocket, 'new_message');

      // Aucun join_conversations : le client qui revient ne le renvoie pas forcément
      aliceSocket.emit('send_message', { conversationId, content: 'Tu es de retour ?' });
      await sleep(400);

      expect(messages.map((m) => m.content)).toEqual(['Tu es de retour ?']);
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
    }
  });
});

describe('GET /api/conversations/:id/messages — pagination', () => {
  let pagedId;
  const url = () => `/api/conversations/${pagedId}/messages`;

  beforeAll(async () => {
    const res = await authed('post', '/api/conversations', alice).send({ memberIds: [carol.id] });
    pagedId = res.body.id;
    createdConversationIds.push(pagedId);

    const start = Date.now() - 60 * 60 * 1000;
    await prisma.message.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        content: `Message ${i + 1}`,
        conversationId: pagedId,
        senderId: alice.id,
        createdAt: new Date(start + i * 1000),
      })),
    });
  });

  it('renvoie par défaut les 50 plus récents, du plus ancien au plus récent', async () => {
    const res = await authed('get', url(), alice);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
    expect(res.body[0].content).toBe('Message 6');
    expect(res.body[49].content).toBe('Message 55');
  });

  it('charge les messages précédents avec before, sans doublon', async () => {
    const page = await authed('get', url(), alice);
    const res = await authed('get', `${url()}?before=${page.body[0].id}`, alice);

    expect(res.body.map((m) => m.content)).toEqual([
      'Message 1',
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5',
    ]);
  });

  it('plafonne limit à 100 et ignore une valeur invalide', async () => {
    const capped = await authed('get', `${url()}?limit=100000`, alice);
    const invalid = await authed('get', `${url()}?limit=abc`, alice);

    expect(capped.body).toHaveLength(55);
    expect(invalid.body).toHaveLength(50);
  });

  it('refuse un curseur venant d’une autre conversation (404)', async () => {
    const other = await authed('get', `/api/conversations/${pagedId}/messages`, alice);
    const res = await authed(
      'get',
      `/api/conversations/${conversationId}/messages?before=${other.body[0].id}`,
      alice
    );

    expect(res.status).toBe(404);
  });
});

describe('Groupes — modification et ajout de membres', () => {
  let groupId;

  beforeAll(async () => {
    const res = await authed('post', '/api/conversations', alice).send({
      memberIds: [bob.id],
      isGroup: true,
      name: 'Projet',
    });
    groupId = res.body.id;
    createdConversationIds.push(groupId);
  });

  it('permet à un membre de renommer le groupe', async () => {
    const res = await authed('patch', `/api/conversations/${groupId}`, bob).send({
      name: 'Ventes',
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ventes');
  });

  it('refuse la modification à un non-membre (403)', async () => {
    const res = await authed('patch', `/api/conversations/${groupId}`, outsider).send({
      name: 'Piraté',
    });

    expect(res.status).toBe(403);
  });

  it('refuse un nom vide (400)', async () => {
    const res = await authed('patch', `/api/conversations/${groupId}`, alice).send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  it('ajoute un membre, qui accède ensuite aux messages', async () => {
    const res = await authed('post', `/api/conversations/${groupId}/members`, bob).send({
      userIds: [carol.id],
    });
    const history = await authed('get', `/api/conversations/${groupId}/messages`, carol);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(3);
    expect(history.status).toBe(200);
  });

  it('refuse l’ajout par un non-membre (403)', async () => {
    const res = await authed('post', `/api/conversations/${groupId}/members`, outsider).send({
      userIds: [outsider.id],
    });

    expect(res.status).toBe(403);
  });

  it('refuse d’ajouter quelqu’un de déjà membre (400)', async () => {
    const res = await authed('post', `/api/conversations/${groupId}/members`, alice).send({
      userIds: [bob.id],
    });

    expect(res.status).toBe(400);
  });

  it('réserve la suppression du groupe à son créateur (403)', async () => {
    const res = await authed('delete', `/api/conversations/${groupId}`, bob);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/login — limitation', () => {
  it('bloque après 10 échecs, avec un message clair (429)', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: alice.email, password: 'mauvais-mot-de-passe' });

    for (let i = 0; i < 10; i += 1) {
      const res = await attempt();
      expect(res.status).toBe(401);
      // La fenêtre est décomptée une fois la réponse envoyée
      await sleep(10);
    }

    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/tentatives/i);
  });
});
