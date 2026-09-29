// Tests d'intégration des conversations : droits d'accès (cœur du système
// exigé par le cahier des charges, section 7), anti-duplication des
// conversations 1:1, et compteur de messages non lus.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { uniqueUser, cleanupTestData } from './helpers.js';

const createdUserIds = [];
const createdConversationIds = [];

async function registerUser(label) {
  const user = uniqueUser(label);
  const res = await request(app).post('/api/auth/register').send(user);
  createdUserIds.push(res.body.user.id);
  return { ...user, id: res.body.user.id, token: res.body.token };
}

let alice;
let bob;
let carol;
let outsider;

beforeAll(async () => {
  alice = await registerUser('alice');
  bob = await registerUser('bob');
  carol = await registerUser('carol');
  outsider = await registerUser('outsider');
});

describe('POST /api/conversations — création', () => {
  it('refuse une conversation de groupe sans nom (400)', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id], isGroup: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nom/i);
  });

  it('refuse un memberIds vide ou absent (400)', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [] });

    expect(res.status).toBe(400);
  });

  it('refuse un utilisateur invité inexistant (400)', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: ['00000000-0000-0000-0000-000000000000'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/introuvable/i);
  });

  it("réutilise la conversation 1:1 existante au lieu d'en créer une nouvelle", async () => {
    const first = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id] });
    expect(first.status).toBe(201);
    createdConversationIds.push(first.body.id);

    const second = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id] });

    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it('crée une conversation de groupe avec tous les membres', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id, carol.id], isGroup: true, name: 'Groupe de test' });

    expect(res.status).toBe(201);
    expect(res.body.members).toHaveLength(3);
    createdConversationIds.push(res.body.id);
  });
});

describe("GET /api/conversations/:id/messages — droits d'accès", () => {
  let conversationId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id, carol.id], isGroup: true, name: 'Groupe accès' });
    conversationId = res.body.id;
    createdConversationIds.push(conversationId);
  });

  it("refuse l'accès à un utilisateur non membre (403)", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/accès refusé/i);
  });

  it('refuse toute requête sans token (401)', async () => {
    const res = await request(app).get(`/api/conversations/${conversationId}/messages`);
    expect(res.status).toBe(401);
  });

  it("autorise l'accès à un membre de la conversation (200)", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Compteur de messages non lus', () => {
  it('passe à 0 après un appel à /read', async () => {
    const createRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id] });
    const conversationId = createRes.body.id;
    createdConversationIds.push(conversationId);

    // Bob n'a pas encore de moyen HTTP d'envoyer un message (c'est le rôle
    // du WebSocket, testé dans realtime.test.js) : on vérifie ici que
    // /read fonctionne et ne casse rien pour un membre sans message non lu.
    const readRes = await request(app)
      .post(`/api/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body).toEqual({ success: true });
  });

  it("refuse de marquer comme lue une conversation dont on n'est pas membre (403)", async () => {
    const createRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ memberIds: [bob.id] });
    const conversationId = createRes.body.id;
    createdConversationIds.push(conversationId);

    const res = await request(app)
      .post(`/api/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds, conversationIds: createdConversationIds });
});
