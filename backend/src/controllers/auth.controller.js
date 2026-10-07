const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');
const { validateRegisterInput, validateLoginInput } = require('../utils/validators');

// Durée de vie du jeton de session :
// - connexion normale : 1 jour (le navigateur l'oublie de toute façon à la
//   fermeture, voir sessionStorage côté frontend) ;
// - case « Se souvenir de moi » cochée : 8 jours.
// Le mot de passe n'est jamais stocké ni dans le navigateur ni dans un cookie :
// seul ce jeton signé (qui expire) est conservé.
const SESSION_DURATION = '1d';
const REMEMBER_ME_DURATION = '8d';

function signToken(userId, rememberMe) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: rememberMe === true ? REMEMBER_ME_DURATION : SESSION_DURATION,
  });
}

const register = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  const validationErrors = validateRegisterInput({ email, username, password });
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
  });
  if (existing) {
    return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, username: normalizedUsername, passwordHash },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  const token = signToken(user.id, false);

  res.status(201).json({ user, token });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const validationErrors = validateLoginInput({ email, password });
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors[0], errors: validationErrors });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = signToken(user.id, rememberMe);

  res.json({
    user: { id: user.id, email: user.email, username: user.username },
    token,
  });
});

module.exports = { register, login };
