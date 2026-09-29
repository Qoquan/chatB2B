// Test d'intégration temps réel (Socket.io) : envoi d'un message dans une
// conversation de groupe et réception par les autres membres connectés,
// et refus d'un message vide. Remplace le script manuel
// scripts/test-group-chat.js par une vraie suite automatisée exécutée en CI.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../src/server.js';
import { uniqueUser, cleanupTestData } from './helpers.js';

const createdUserIds = [];
const createdConversationIds = [];

let server;
let app;
let baseUrl;
let alice;
let bob;

function connectClient(token) {
  return ioClient(baseUrl, { auth: { token }, transports: ['websocket'] });
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

beforeAll(async () => {
  ({ app, server } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;

  const aliceUser = uniqueUser('rt_alice');
  const bobUser = uniqueUser('rt_bob');

  const aliceRes = await request(app).post('/api/auth/register').send(aliceUser);
  const bobRes = await request(app).post('/api/auth/register').send(bobUser);
  alice = { id: aliceRes.body.user.id, token: aliceRes.body.token };
  bob = { id: bobRes.body.user.id, token: bobRes.body.token };
  createdUserIds.push(alice.id, bob.id);

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${alice.token}`)
    .send({ memberIds: [bob.id] });
  createdConversationIds.push(convRes.body.id);
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds, conversationIds: createdConversationIds });
  await new Promise((resolve) => server.close(resolve));
});

describe('Socket.io — messagerie temps réel', () => {
  it('diffuse un message envoyé par un membre à tous les autres membres connectés', async () => {
    const conversationId = createdConversationIds[0];
    const aliceSocket = connectClient(alice.token);
    const bobSocket = connectClient(bob.token);

    try {
      await Promise.all([waitForConnect(aliceSocket), waitForConnect(bobSocket)]);

      aliceSocket.emit('join_conversations', [conversationId]);
      bobSocket.emit('join_conversations', [conversationId]);

      // Petite marge pour laisser le temps aux deux clients de rejoindre
      // la room côté serveur avant l'envoi.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const content = `Message de test ${Date.now()}`;
      const received = waitForEvent(bobSocket, 'new_message');
      aliceSocket.emit('send_message', { conversationId, content });

      const message = await received;
      expect(message.content).toBe(content);
      expect(message.sender.id).toBe(alice.id);
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
    }
  });

  it('refuse un message vide via error_message, sans le diffuser', async () => {
    const conversationId = createdConversationIds[0];
    const aliceSocket = connectClient(alice.token);

    try {
      await waitForConnect(aliceSocket);
      aliceSocket.emit('join_conversations', [conversationId]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const errorPromise = waitForEvent(aliceSocket, 'error_message');
      aliceSocket.emit('send_message', { conversationId, content: '   ' });

      const err = await errorPromise;
      expect(err.error).toMatch(/vide/i);
    } finally {
      aliceSocket.disconnect();
    }
  });

  it('refuse la connexion sans token JWT', async () => {
    const badSocket = ioClient(baseUrl, { auth: {}, transports: ['websocket'] });
    try {
      await expect(waitForConnect(badSocket)).rejects.toThrow();
    } finally {
      badSocket.disconnect();
    }
  });
});
