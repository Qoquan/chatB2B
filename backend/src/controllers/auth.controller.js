const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');
const { validateRegisterInput, validateLoginInput } = require('../utils/validators');

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

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.status(201).json({ user, token });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

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

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.json({
    user: { id: user.id, email: user.email, username: user.username },
    token,
  });
});

module.exports = { register, login };
