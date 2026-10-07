// Suppression de compte (RGPD) : le compte est anonymisé mais ses messages et
// ses fichiers restent lisibles par les autres membres, avec un auteur marqué
// « supprimé » (deletedAt). Vérifie aussi les conséquences : connexion
// impossible, discussion privée en lecture seule, groupe qui reste utilisable,
// conversations abandonnées nettoyées, suppression d'un groupe avec fichiers.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';
import { uniqueUser, cleanupTestData, prisma } from './helpers.js';

const createdUserIds = [];
const createdConversationIds = [];
const PASSWORD = 'motdepasse123';

let app;
let server;

// PNG minimal valide (1x1 pixel)
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function auth(user) {
  return { Authorization: `Bearer ${user.token}` };
}

async function registerUser(label) {
  const credentials = uniqueUser(label);
  const res = await request(app).post('/api/auth/register').send(credentials);
  const user = { id: res.body.user.id, token: res.body.token, email: credentials.email };
  createdUserIds.push(user.id);
  return user;
}

async function createConversation(creator, body) {
  const res = await request(app).post('/api/conversations').set(auth(creator)).send(body);
  createdConversationIds.push(res.body.id);
  return res.body.id;
}

function sendFile(user, conversationId) {
  return request(app)
    .post(`/api/conversations/${conversationId}/attachments`)
    .set(auth(user))
    .attach('file', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
    .field('content', 'Ma photo');
}

function deleteAccount(user, password = PASSWORD) {
  return request(app).delete('/api/users/me').set(auth(user)).send({ currentPassword: password });
}

beforeAll(() => {
  ({ app, server } = createServer());
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds, conversationIds: createdConversationIds });
  await new Promise((resolve) => server.close(resolve));
});

describe('Suppression de compte — anonymisation', () => {
  let alice;
  let bob;
  let conversationId;
  let attachmentId;

  beforeAll(async () => {
    alice = await registerUser('del_alice');
    bob = await registerUser('del_bob');
    conversationId = await createConversation(alice, { memberIds: [bob.id] });
    const sent = await sendFile(alice, conversationId);
    expect(sent.status).toBe(201);
    attachmentId = sent.body.attachment.id;
  });

  it('refuse la suppression avec un mauvais mot de passe (403)', async () => {
    const res = await deleteAccount(alice, 'mauvais-mot-de-passe');
    expect(res.status).toBe(403);
  });

  it('anonymise le compte au lieu de le supprimer (200)', async () => {
    const res = await deleteAccount(alice);
    expect(res.status).toBe(200);

    const row = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(row).not.toBeNull();
    expect(row.deletedAt).not.toBeNull();
    expect(row.email).not.toBe(alice.email);
    expect(row.email).toMatch(/@deleted\.invalid$/);
    expect(row.username).toMatch(/^deleted_/);
    expect(row.avatarUrl).toBeNull();
  });

  it('conserve les messages et les fichiers pour les autres membres', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(bob));
    expect(res.status).toBe(200);
    const message = res.body.find((m) => m.attachment && m.attachment.id === attachmentId);
    expect(message).toBeDefined();
    expect(message.content).toBe('Ma photo');
    expect(message.sender.id).toBe(alice.id);
    expect(message.sender.deletedAt).not.toBeNull();

    const download = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${attachmentId}`)
      .set(auth(bob));
    expect(download.status).toBe(200);
  });

  it('marque le membre supprimé dans la liste des conversations', async () => {
    const res = await request(app).get('/api/conversations').set(auth(bob));
    expect(res.status).toBe(200);
    const conv = res.body.find((c) => c.id === conversationId);
    const member = conv.members.find((m) => m.user.id === alice.id);
    expect(member.user.deletedAt).not.toBeNull();
  });

  it('empêche de se reconnecter avec les anciens identifiants (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: alice.email, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("rejette l'ancien token du compte supprimé (401)", async () => {
    const res = await request(app).get('/api/users/me').set(auth(alice));
    expect(res.status).toBe(401);
  });

  it("n'apparaît plus dans la liste des utilisateurs à contacter", async () => {
    const res = await request(app).get('/api/users').set(auth(bob));
    expect(res.status).toBe(200);
    expect(res.body.some((u) => u.id === alice.id)).toBe(false);
  });

  it('interdit de créer une nouvelle conversation avec un compte supprimé (400)', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set(auth(bob))
      .send({ memberIds: [alice.id] });
    expect(res.status).toBe(400);
  });

  it('laisse la discussion privée en lecture seule : envoi de fichier refusé (403)', async () => {
    const res = await sendFile(bob, conversationId);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/supprimé/i);
  });
});

describe('Suppression de compte — groupes et conversations abandonnées', () => {
  it('un groupe reste utilisable et administrable après le départ de son créateur', async () => {
    const alice = await registerUser('grp_alice');
    const bob = await registerUser('grp_bob');
    const carol = await registerUser('grp_carol');
    const groupId = await createConversation(alice, {
      memberIds: [bob.id, carol.id],
      isGroup: true,
      name: 'Groupe de test',
    });
    expect((await sendFile(alice, groupId)).status).toBe(201);

    expect((await deleteAccount(alice)).status).toBe(200);

    // Les membres restants peuvent encore écrire dans le groupe
    expect((await sendFile(bob, groupId)).status).toBe(201);

    // Le groupe a été confié à un membre actif
    const group = await prisma.conversation.findUnique({ where: { id: groupId } });
    expect([bob.id, carol.id]).toContain(group.createdById);

    // Les messages de la personne supprimée sont toujours là
    const messages = await request(app)
      .get(`/api/conversations/${groupId}/messages`)
      .set(auth(bob));
    expect(messages.body.filter((m) => m.sender.id === alice.id)).toHaveLength(1);
  });

  it("efface vraiment la conversation quand plus aucun compte actif n'y reste", async () => {
    const alice = await registerUser('gone_alice');
    const bob = await registerUser('gone_bob');
    const conversationId = await createConversation(alice, { memberIds: [bob.id] });
    const sent = await sendFile(alice, conversationId);
    expect(sent.status).toBe(201);
    const attachmentId = sent.body.attachment.id;

    expect((await deleteAccount(alice)).status).toBe(200);
    expect(await prisma.conversation.findUnique({ where: { id: conversationId } })).not.toBeNull();

    expect((await deleteAccount(bob)).status).toBe(200);
    expect(await prisma.conversation.findUnique({ where: { id: conversationId } })).toBeNull();
    expect(await prisma.attachment.findUnique({ where: { id: attachmentId } })).toBeNull();
    expect(await prisma.message.count({ where: { conversationId } })).toBe(0);
  });

  it("la suppression d'un groupe par son créateur efface aussi les fichiers (200)", async () => {
    const alice = await registerUser('rm_alice');
    const bob = await registerUser('rm_bob');
    const groupId = await createConversation(alice, {
      memberIds: [bob.id],
      isGroup: true,
      name: 'Groupe à supprimer',
    });
    const sent = await sendFile(bob, groupId);
    expect(sent.status).toBe(201);

    const res = await request(app).delete(`/api/conversations/${groupId}`).set(auth(alice));
    expect(res.status).toBe(200);
    expect(
      await prisma.attachment.findUnique({ where: { id: sent.body.attachment.id } })
    ).toBeNull();
  });
});
