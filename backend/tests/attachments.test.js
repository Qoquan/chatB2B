// Tests d'intégration des pièces jointes : envoi d'un fichier dans une
// conversation, refus des fichiers dangereux ou trop gros, téléchargement
// réservé aux membres, et diffusion temps réel du message qui porte le fichier.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../src/server.js';
import { uniqueUser, cleanupTestData } from './helpers.js';

const createdUserIds = [];
const createdConversationIds = [];

let app;
let server;
let baseUrl;
let alice;
let bob;
let carol;
let conversationId; // alice + bob
let otherConversationId; // alice + carol

// PNG minimal valide (1x1 pixel)
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

// Récupère le corps d'une réponse binaire sous forme de Buffer
function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function auth(user) {
  return { Authorization: `Bearer ${user.token}` };
}

function upload(user, convId, buffer, filename, contentType, caption) {
  const req = request(app)
    .post(`/api/conversations/${convId}/attachments`)
    .set(auth(user))
    .attach('file', buffer, { filename, contentType });
  return caption ? req.field('content', caption) : req;
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
  const res = await request(app).post('/api/auth/register').send(uniqueUser(label));
  const user = { id: res.body.user.id, token: res.body.token };
  createdUserIds.push(user.id);
  return user;
}

async function createConversation(creator, memberId) {
  const res = await request(app)
    .post('/api/conversations')
    .set(auth(creator))
    .send({ memberIds: [memberId] });
  createdConversationIds.push(res.body.id);
  return res.body.id;
}

beforeAll(async () => {
  ({ app, server } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  alice = await registerUser('att_alice');
  bob = await registerUser('att_bob');
  carol = await registerUser('att_carol');

  conversationId = await createConversation(alice, bob.id);
  otherConversationId = await createConversation(alice, carol.id);
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds, conversationIds: createdConversationIds });
  await new Promise((resolve) => server.close(resolve));
});

describe('POST /api/conversations/:id/attachments — envoi', () => {
  it('refuse une requête sans token (401)', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/attachments`)
      .attach('file', PNG_BYTES, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it("refuse un utilisateur qui n'est pas membre de la conversation (403)", async () => {
    const res = await upload(carol, conversationId, PNG_BYTES, 'a.png', 'image/png');
    expect(res.status).toBe(403);
  });

  it('refuse une requête sans fichier (400)', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/attachments`)
      .set(auth(alice))
      .field('content', 'oups, pas de fichier');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/aucun fichier/i);
  });

  it('refuse un type de fichier non autorisé (400)', async () => {
    const res = await upload(
      alice,
      conversationId,
      Buffer.from('MZ\x90\x00'),
      'virus.exe',
      'application/x-msdownload'
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non autorisé/i);
  });

  it('refuse un fichier déguisé : faux PNG dont le contenu est du texte (400)', async () => {
    const res = await upload(
      alice,
      conversationId,
      Buffer.from('ceci est du texte, pas une image'),
      'faux.png',
      'image/png'
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/contenu/i);
  });

  it('refuse un fichier de plus de 5 Mo (413)', async () => {
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x61);
    PNG_BYTES.copy(tooBig); // signature PNG valide au début : seule la taille est en cause
    const res = await upload(alice, conversationId, tooBig, 'gros.png', 'image/png');
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/volumineux/i);
  });

  it('enregistre un fichier valide et renvoie les métadonnées sans le contenu (201)', async () => {
    const res = await upload(
      alice,
      conversationId,
      PNG_BYTES,
      'capture.png',
      'image/png',
      'Voici la capture'
    );
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Voici la capture');
    expect(res.body.senderId).toBe(alice.id);
    expect(res.body.conversationId).toBe(conversationId);
    expect(res.body.attachment).toMatchObject({
      fileName: 'capture.png',
      mimeType: 'image/png',
      size: PNG_BYTES.length,
    });
    // Le contenu binaire ne doit jamais être renvoyé dans le message
    expect(res.body.attachment.data).toBeUndefined();
  });

  it('accepte un fichier sans légende (message au contenu vide)', async () => {
    const res = await upload(alice, conversationId, PDF_BYTES, 'devis.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('');
    expect(res.body.attachment.fileName).toBe('devis.pdf');
  });
});

describe('Historique et téléchargement', () => {
  let attachment;

  beforeAll(async () => {
    const res = await upload(bob, conversationId, PNG_BYTES, 'photo.png', 'image/png');
    attachment = res.body.attachment;
  });

  it("l'historique des messages contient les métadonnées de la pièce jointe", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(bob));
    expect(res.status).toBe(200);
    const withFile = res.body.find((m) => m.attachment && m.attachment.id === attachment.id);
    expect(withFile).toBeDefined();
    expect(withFile.attachment.fileName).toBe('photo.png');
    expect(withFile.attachment.data).toBeUndefined();
  });

  it('un membre télécharge le fichier à l’identique, avec les bons en-têtes', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${attachment.id}`)
      .set(auth(alice))
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/png/);
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body, PNG_BYTES)).toBe(0);
  });

  it('un PDF est servi en téléchargement (attachment), pas affiché dans la page', async () => {
    const sent = await upload(alice, conversationId, PDF_BYTES, 'facture.pdf', 'application/pdf');
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${sent.body.attachment.id}`)
      .set(auth(bob))
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['content-disposition']).toContain('facture.pdf');
  });

  it('refuse sans token (401)', async () => {
    const res = await request(app).get(
      `/api/conversations/${conversationId}/attachments/${attachment.id}`
    );
    expect(res.status).toBe(401);
  });

  it("refuse un utilisateur qui n'est pas membre de la conversation (403)", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${attachment.id}`)
      .set(auth(carol));
    expect(res.status).toBe(403);
  });

  it('renvoie 404 pour une pièce jointe inexistante', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/00000000-0000-0000-0000-000000000000`)
      .set(auth(alice));
    expect(res.status).toBe(404);
  });

  it("refuse l'accès à un fichier d'une autre conversation, même pour un membre des deux (404)", async () => {
    // alice est membre des deux conversations : le fichier appartient à la première,
    // il ne doit pas être lisible en passant par l'URL de la seconde.
    const res = await request(app)
      .get(`/api/conversations/${otherConversationId}/attachments/${attachment.id}`)
      .set(auth(alice));
    expect(res.status).toBe(404);
  });
});

describe('Temps réel', () => {
  it('diffuse le message avec sa pièce jointe aux autres membres connectés', async () => {
    const bobSocket = ioClient(baseUrl, { auth: { token: bob.token }, transports: ['websocket'] });

    try {
      await waitForConnect(bobSocket);
      bobSocket.emit('join_conversations', [conversationId]);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const received = waitForEvent(bobSocket, 'new_message');
      await upload(alice, conversationId, PNG_BYTES, 'live.png', 'image/png');

      const message = await received;
      expect(message.sender.id).toBe(alice.id);
      expect(message.attachment.fileName).toBe('live.png');
      expect(message.attachment.data).toBeUndefined();
    } finally {
      bobSocket.disconnect();
    }
  });
});
