import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import jwt from 'jsonwebtoken'

const router = express.Router();

// get all documents for the logged in user
router.get('/', authenticate, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { ownerId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true }
    });
    res.json(documents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// create a new document
router.post('/', authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    const document = await prisma.document.create({
      data: {
        title: title || 'Untitled Document',
        ownerId: req.userId
      }
    });
    res.status(201).json(document);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// get a single document
router.get('/:id', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// update document content
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { content, title } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...(content !== undefined && { content }),
        ...(title !== undefined && { title })
      }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// delete a document
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// generate a share link
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const { permission } = req.body // 'view' or 'edit'

    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    // generate a signed share token
    const shareToken = jwt.sign(
      { documentId: req.params.id, permission },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      shareUrl: `${process.env.CLIENT_URL}/share/${shareToken}`,
      permission
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// access a shared document via token
router.get('/shared/:shareToken', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.shareToken, process.env.JWT_SECRET)
    const { documentId, permission } = decoded

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })

    res.json({ ...document, permission })
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired share link' })
  }
})

export default router;