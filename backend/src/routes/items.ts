import express, { Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { io } from '../index.js';

const router = express.Router();

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { listId, title, quantity = 1, unit = '', categoryId, priority = 0, dueDate, notes = '' } = req.body;

  if (!listId || !title || typeof title !== 'string' || title.trim().length < 2) {
    return res.status(400).json({ error: 'listId und ein gültiger Titel sind erforderlich.' });
  }

  if (Number(quantity) < 1) {
    return res.status(400).json({ error: 'Menge muss mindestens 1 sein.' });
  }

  try {
    const list = await prisma.list.findUnique({
      where: { id: listId },
      include: { accesses: true }
    });

    if (!list) {
      return res.status(404).json({ error: 'Liste nicht gefunden.' });
    }

    const allowed = list.creatorId === req.user!.id || list.accesses.some((access) => access.userId === req.user!.id);

    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    const item = await prisma.item.create({
      data: {
        title: title.trim(),
        quantity: Number(quantity),
        unit: String(unit),
        notes: String(notes),
        priority: Number(priority),
        dueDate: dueDate ? new Date(dueDate) : null,
        listId,
        categoryId: categoryId || null,
        creatorId: req.user!.id
      },
      include: {
        creator: { select: { id: true, username: true } },
        category: true
      }
    });

    io.to(`list-${listId}`).emit('item-created', item);

    return res.status(201).json(item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Eintrag konnte nicht erstellt werden.' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, completed, quantity, unit, notes, priority, dueDate, categoryId } = req.body;

  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: { list: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
    }

    const list = await prisma.list.findUnique({
      where: { id: item.listId },
      include: { accesses: true }
    });

    const allowed = list?.creatorId === req.user!.id || list?.accesses.some((access) => access.userId === req.user!.id);

    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    const updated = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        ...(typeof title === 'string' && title.trim().length > 0 && { title: title.trim() }),
        ...(typeof completed === 'boolean' && { completed }),
        ...(typeof quantity === 'number' && quantity >= 1 && { quantity }),
        ...(typeof unit === 'string' && { unit: unit.trim() }),
        ...(typeof notes === 'string' && { notes }),
        ...(typeof priority === 'number' && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null })
      },
      include: {
        creator: { select: { id: true, username: true } },
        category: true
      }
    });

    io.to(`list-${item.listId}`).emit('item-updated', updated);

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Eintrag konnte nicht aktualisiert werden.' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });

    if (!item) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
    }

    const list = await prisma.list.findUnique({
      where: { id: item.listId },
      include: { accesses: true }
    });

    const allowed = list?.creatorId === req.user!.id || list?.accesses.some((access) => access.userId === req.user!.id);

    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    await prisma.item.delete({ where: { id: req.params.id } });

    io.to(`list-${item.listId}`).emit('item-deleted', { id: req.params.id });

    return res.json({ message: 'Eintrag gelöscht.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Eintrag konnte nicht gelöscht werden.' });
  }
});

export default router;
