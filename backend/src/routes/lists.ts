import express, { Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { io } from '../index.js';

const router = express.Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const lists = await prisma.list.findMany({
      where: {
        OR: [
          { creatorId: req.user!.id },
          { accesses: { some: { userId: req.user!.id } } }
        ]
      },
      include: {
        creator: { select: { id: true, username: true } },
        items: { select: { id: true, completed: true } },
        accesses: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const result = lists.map((list) => ({
      ...list,
      itemCount: list.items.length,
      completedCount: list.items.filter((item) => item.completed).length
    }));

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Listen konnten nicht geladen werden.' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, color = 'blue', icon = 'list' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Titel ist erforderlich.' });
  }

  try {
    const list = await prisma.list.create({
      data: {
        title,
        color,
        icon,
        creatorId: req.user!.id
      },
      include: {
        creator: { select: { id: true, username: true } }
      }
    });

    return res.status(201).json(list);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Liste konnte nicht erstellt werden.' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await prisma.list.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, username: true, email: true } },
        accesses: {
          include: { user: { select: { id: true, username: true, email: true } } }
        },
        categories: true,
        items: {
          include: {
            creator: { select: { id: true, username: true } },
            category: true
          },
          orderBy: [{ completed: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!list) {
      return res.status(404).json({ error: 'Liste nicht gefunden.' });
    }

    const allowed = list.creatorId === req.user!.id || list.accesses.some((access) => access.userId === req.user!.id);

    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }

    return res.json(list);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Liste konnte nicht geladen werden.' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, color, icon } = req.body;

  try {
    const list = await prisma.list.findUnique({ where: { id: req.params.id } });

    if (!list) {
      return res.status(404).json({ error: 'Liste nicht gefunden.' });
    }

    if (list.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Nur der Ersteller kann die Liste bearbeiten.' });
    }

    const updated = await prisma.list.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(color && { color }),
        ...(icon && { icon })
      },
      include: {
        creator: { select: { id: true, username: true } }
      }
    });

    io.to(`list-${req.params.id}`).emit('list-updated', updated);

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Liste konnte nicht aktualisiert werden.' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await prisma.list.findUnique({ where: { id: req.params.id } });

    if (!list) {
      return res.status(404).json({ error: 'Liste nicht gefunden.' });
    }

    if (list.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Nur der Ersteller kann die Liste löschen.' });
    }

    await prisma.list.delete({ where: { id: req.params.id } });

    io.to(`list-${req.params.id}`).emit('list-deleted', { id: req.params.id });

    return res.json({ message: 'Liste gelöscht.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Liste konnte nicht gelöscht werden.' });
  }
});

router.post('/:id/share', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { email, role = 'viewer' } = req.body;

  try {
    const list = await prisma.list.findUnique({ where: { id: req.params.id } });

    if (!list) {
      return res.status(404).json({ error: 'Liste nicht gefunden.' });
    }

    if (list.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Nur der Ersteller kann freigeben.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    const access = await prisma.listAccess.upsert({
      where: {
        userId_listId: {
          userId: user.id,
          listId: req.params.id
        }
      },
      update: { role },
      create: {
        userId: user.id,
        listId: req.params.id,
        role
      },
      include: { user: { select: { id: true, username: true, email: true } } }
    });

    io.to(`list-${req.params.id}`).emit('list-shared', access);

    return res.status(201).json(access);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Liste konnte nicht freigegeben werden.' });
  }
});

export default router;
