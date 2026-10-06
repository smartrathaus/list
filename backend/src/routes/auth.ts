import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { prisma } from '../index.js';
import { getJwtSecret } from '../middleware/auth.js';

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isStrongPassword = (password: string) => password.length >= 8;

router.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, Benutzername und Passwort sind erforderlich.' });
  }

  if (!emailPattern.test(String(email))) {
    return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  }

  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'Der Benutzername muss mindestens 3 Zeichen lang sein.' });
  }

  if (!isStrongPassword(String(password))) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: String(email) }, { username: String(username) }]
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben.' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        username: String(username).trim(),
        password: hashedPassword
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Registrierung fehlgeschlagen.' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Falsche E-Mail oder Passwort.' });
    }

    const valid = await bcrypt.compare(String(password), user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Falsche E-Mail oder Passwort.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login fehlgeschlagen.' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      username: user.username
    });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
