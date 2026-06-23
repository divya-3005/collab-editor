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

// ==========================================
// VERSION HISTORY ROUTES
// ==========================================

// Create a new version snapshot
router.post('/:id/snapshot', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })
    
    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    // Find the highest version number
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: req.params.id },
      orderBy: { versionNumber: 'desc' }
    })
    
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1

    const snapshot = await prisma.documentVersion.create({
      data: {
        documentId: req.params.id,
        versionNumber: newVersionNumber,
        title: document.title,
        content: document.content,
        name: req.body.name || null
      }
    })

    res.status(201).json(snapshot)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// List all versions for a document
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })
    
    if (!document) return res.status(404).json({ error: 'Document not found' })
    // In a real app, viewers might also be allowed to see history. For now, restrict to owner.
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: req.params.id },
      select: { id: true, versionNumber: true, createdAt: true, name: true },
      orderBy: { versionNumber: 'desc' }
    })

    res.json(versions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get content of a specific version
router.get('/:id/versions/:versionId', authenticate, async (req, res) => {
  try {
    const version = await prisma.documentVersion.findUnique({
      where: { id: req.params.versionId }
    })
    
    if (!version || version.documentId !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' })
    }

    res.json(version)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Restore a specific version
router.post('/:id/versions/:versionId/restore', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })
    
    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const version = await prisma.documentVersion.findUnique({
      where: { id: req.params.versionId }
    })
    
    if (!version || version.documentId !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' })
    }

    // 1. Update the document with the version's content and title
    const updatedDocument = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        title: version.title,
        content: version.content
      }
    })

    // 2. Automatically create a new snapshot acknowledging the restore
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: req.params.id },
      orderBy: { versionNumber: 'desc' }
    })
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1

    await prisma.documentVersion.create({
      data: {
        documentId: req.params.id,
        versionNumber: newVersionNumber,
        title: version.title,
        content: version.content,
        name: `Restored from Version ${version.versionNumber}`
      }
    })

    res.json(updatedDocument)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router;