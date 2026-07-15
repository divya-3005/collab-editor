/**
 * Document routes — /api/documents
 *
 * CRUD + sharing + version history for documents.
 *
 * All routes except GET /shared/:shareToken require a valid JWT (via the
 * `authenticate` middleware). Ownership is checked on every mutating route.
 *
 * Sharing flow:
 *   1. Owner calls POST /:id/share → server signs a short-lived JWT containing
 *      { documentId, permission } and returns a share URL.
 *   2. Anyone with the URL calls GET /shared/:shareToken → server verifies the
 *      JWT and returns the document content + permission level.
 *
 * Version history flow:
 *   Clients call POST /:id/snapshot to save the current state as a named
 *   version. They can later preview or restore any saved version.
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── GET / — List documents ────────────────────────────────────────────────────
// Returns all documents owned by the authenticated user, newest first.
// We only select the fields the dashboard needs (not `content`) to keep the
// payload small.
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where: { ownerId: req.userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
        skip,
        take: limit
      }),
      prisma.document.count({ where: { ownerId: req.userId } })
    ]);

    res.json({ documents, totalCount, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST / — Create document ──────────────────────────────────────────────────
// Creates a new blank document owned by the authenticated user.
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

// ── GET /:id — Get single document ───────────────────────────────────────────
// Returns full document data (including `content`) for the owner only.
router.get('/:id', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only the document owner can access via this route.
    // Collaborators use the /shared/:shareToken route instead.
    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /:id — Update document ─────────────────────────────────────────────
// Partial update: accepts `content`, `title`, or both.
// Called by the client's auto-save (every 3 seconds) and on title blur.
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

    // Only update the fields that were actually provided
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

// ── DELETE /:id — Delete document ─────────────────────────────────────────────
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

// ── POST /:id/share — Generate share link ────────────────────────────────────
// Creates a signed JWT encoding { documentId, permission } and returns a URL.
// The token itself IS the share link — there is no separate share table in the DB.
// Anyone who has the URL can access the document until the token expires (7 days).
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const { permission } = req.body; // 'view' | 'edit'

    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' });

    // The share token encodes the document's ID and the granted permission level.
    // jwt.sign uses the same JWT_SECRET as auth tokens — it's just a different payload.
    const shareToken = jwt.sign(
      { documentId: req.params.id, permission },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      shareUrl: `${process.env.CLIENT_URL}/share/${shareToken}`,
      permission
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /shared/:shareToken — Access shared document ─────────────────────────
// Public route (no auth required). Verifies the share token and returns the
// document content along with the `permission` encoded in the token.
router.get('/shared/:shareToken', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.shareToken, process.env.JWT_SECRET);
    const { documentId, permission } = decoded;

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Merge the permission level into the document response so the client
    // knows whether to render the editor in read-only or edit mode.
    res.json({ ...document, permission });
  } catch (err) {
    // jwt.verify throws if the token is expired, tampered with, or malformed
    res.status(401).json({ error: 'Invalid or expired share link' });
  }
});

// ── VERSION HISTORY ───────────────────────────────────────────────────────────
// Snapshots are point-in-time copies of a document's content and title.
// They are stored in the DocumentVersion table and can be previewed or restored.

// POST /:id/snapshot — Save current state as a new version
router.post('/:id/snapshot', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' });

    // Find the highest existing version number so we can increment it
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: req.params.id },
      orderBy: { versionNumber: 'desc' }
    });

    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const snapshot = await prisma.documentVersion.create({
      data: {
        documentId: req.params.id,
        versionNumber: newVersionNumber,
        title: document.title,
        content: document.content,
        name: req.body.name || null // Optional human-readable label (e.g. "Before refactor")
      }
    });

    res.status(201).json(snapshot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /:id/versions — List all version summaries (no content, for the sidebar)
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' });

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: req.params.id },
      // Only return metadata, not content — the sidebar only needs timestamps & version numbers.
      // Content is fetched on demand when the user clicks "Preview".
      select: { id: true, versionNumber: true, createdAt: true, name: true },
      orderBy: { versionNumber: 'desc' }
    });

    res.json(versions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /:id/versions/:versionId — Get full content of one version (for preview)
router.get('/:id/versions/:versionId', authenticate, async (req, res) => {
  try {
    const version = await prisma.documentVersion.findUnique({
      where: { id: req.params.versionId }
    });

    // Ensure the version belongs to the requested document
    if (!version || version.documentId !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(version);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/versions/:versionId/restore — Roll back document to a saved version
// This is a two-step process:
//   1. Overwrite the document's current content with the version's content.
//   2. Auto-create a new snapshot labelled "Restored from Version N" so the
//      rollback itself is auditable and can be undone.
router.post('/:id/versions/:versionId/restore', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' });

    const version = await prisma.documentVersion.findUnique({
      where: { id: req.params.versionId }
    });

    if (!version || version.documentId !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Step 1: Restore the document to the version's content and title
    const updatedDocument = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        title: version.title,
        content: version.content
      }
    });

    // Step 2: Create an audit snapshot so the restore is recorded in the history
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId: req.params.id },
      orderBy: { versionNumber: 'desc' }
    });
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    await prisma.documentVersion.create({
      data: {
        documentId: req.params.id,
        versionNumber: newVersionNumber,
        title: version.title,
        content: version.content,
        name: `Restored from Version ${version.versionNumber}`
      }
    });

    res.json(updatedDocument);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;