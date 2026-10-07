// Tests d'intégration de l'authentification (nécessite une base Postgres
// accessible via DATABASE_URL — voir README des tests / CI).
//
// Couvre l'exigence "gestion propre des exceptions, jamais de stack trace
// à l'écran" : on vérifie que les réponses d'erreur sont des JSON propres
// (champ "error"), sans détail technique.

import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { uniqueUser, cleanupTestData } from './helpers.js';

const createdUserIds = [];

describe('POST /api/auth/register', () => {
  it('refuse un email invalide avec un message clair (400, sans stack trace)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pas-un-email', username: 'testuser', password: 'motdepasse123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('refuse un mot de passe trop court', async () => {
    const user = uniqueUser('shortpw');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: user.email, username: user.username, password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mot de passe/i);
  });

  it('crée un compte avec des données valides (201, renvoie user + token)', async () => {
    const user = uniqueUser('valid');
    const res = await request(app).post('/api/auth/register').send(user);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      email: user.email.toLowerCase(),
      username: user.username,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    createdUserIds.push(res.body.user.id);
  });

  it('refuse un email déjà utilisé (409)', async () => {
    const user = uniqueUser('dup');
    const first = await request(app).post('/api/auth/register').send(user);
    expect(first.status).toBe(201);
    createdUserIds.push(first.body.user.id);

    const second = await request(app).post('/api/auth/register').send(user);
    expect(second.status).toBe(409);
    expect(second.body).toHaveProperty('error');
  });
});

describe('POST /api/auth/login', () => {
  it('connecte un utilisateur avec les bons identifiants', async () => {
    const user = uniqueUser('login');
    const register = await request(app).post('/api/auth/register').send(user);
    createdUserIds.push(register.body.user.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(user.email.toLowerCase());
  });

  it('« Se souvenir de moi » : le jeton dure 8 jours', async () => {
    const user = uniqueUser('remember');
    const register = await request(app).post('/api/auth/register').send(user);
    createdUserIds.push(register.body.user.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password, rememberMe: true });

    expect(res.status).toBe(200);
    const { iat, exp } = jwt.decode(res.body.token);
    expect(exp - iat).toBe(8 * 24 * 60 * 60);
  });

  it('sans « Se souvenir de moi » : le jeton dure 1 jour', async () => {
    const user = uniqueUser('noremember');
    const register = await request(app).post('/api/auth/register').send(user);
    createdUserIds.push(register.body.user.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    const { iat, exp } = jwt.decode(res.body.token);
    expect(exp - iat).toBe(24 * 60 * 60);
  });

  it("ignore une valeur rememberMe qui n'est pas un vrai booléen", async () => {
    const user = uniqueUser('fakeremember');
    const register = await request(app).post('/api/auth/register').send(user);
    createdUserIds.push(register.body.user.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password, rememberMe: 'true' });

    const { iat, exp } = jwt.decode(res.body.token);
    expect(exp - iat).toBe(24 * 60 * 60);
  });

  it('refuse un mauvais mot de passe (401, message générique)', async () => {
    const user = uniqueUser('badpw');
    const register = await request(app).post('/api/auth/register').send(user);
    createdUserIds.push(register.body.user.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'mauvaismotdepasse' });

    expect(res.status).toBe(401);
    // Le message ne doit pas révéler si c'est l'email ou le mot de passe
    // qui est incorrect (bonne pratique de sécurité).
    expect(res.body.error).toMatch(/identifiants invalides/i);
  });

  it('refuse un email inconnu avec le même message générique (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'personne@inconnu.test', password: 'peuimporte' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/identifiants invalides/i);
  });
});

afterAll(async () => {
  await cleanupTestData({ userIds: createdUserIds });
});
