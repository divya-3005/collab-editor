/**
 * documents.js — /api/documents
 *
 * All mutating routes require a valid auth JWT (via `authenticate` middleware).
 * Share routes use a separate share-token JWT (type: 'share') and are public.
 *
 * Security hardening applied in this file:
 *  - HTML content is passed through an allowlist sanitizer before any write to
 *    the database, eliminating the XSS-via-shared-link attack vector.
 *  - Share tokens carry type: 'share'; the shared document route validates this
 *    claim so auth tokens cannot be used as share tokens and vice-versa.
 *  - Version restore is wrapped in a prisma.$transaction to prevent partial
 *    restores and concurrent versionNumber collisions.
 */

// ── Imports ────────────────────────────────────────────────────────────────────
import express from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { sanitizeHtml } from '../utils/sanitize.js'

const router = express.Router()

// ── GET / — List documents ─────────────────────────────────────────────────────
// Returns all documents owned by the authenticated user, newest first.
// Paginated: defaults to page=1, limit=20 (max 500).
// The dashboard currently fetches with limit=500 to show all documents.
router.get('/', authenticate, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 20))
    const skip  = (page - 1) * limit

    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where:   { ownerId: req.userId },
        orderBy: { updatedAt: 'desc' },
        select:  { id: true, title: true, createdAt: true, updatedAt: true },
        skip,
        take: limit
      }),
      prisma.document.count({ where: { ownerId: req.userId } })
    ])

    res.json({ documents, totalCount, page, limit })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST / — Create document ───────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { title } = req.body
    const document = await prisma.document.create({
      data: {
        title:   title || 'Untitled Document',
        ownerId: req.userId
      }
    })
    res.status(201).json(document)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /:id — Get single document ────────────────────────────────────────────
// Returns full document data (including `content`) for the owner only.
// Collaborators use GET /shared/:shareToken instead.
router.get('/:id', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(document)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── PATCH /:id — Update document ──────────────────────────────────────────────
// Partial update: accepts `content`, `title`, or both.
// Content is sanitized before storage to prevent XSS via shared document links.
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { content, title } = req.body

    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Sanitize HTML content before persisting.
    // sanitizeHtml is an allowlist-based sanitizer that strips <script> tags,
    // event handlers, javascript: URIs, and any element not produced by Tiptap's
    // StarterKit. Legitimate formatting (bold, italic, headings, etc.) is preserved.
    const safeContent = content !== undefined ? sanitizeHtml(content) : undefined

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...(safeContent !== undefined && { content: safeContent }),
        ...(title       !== undefined && { title })
      }
    })

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── DELETE /:id — Delete document ─────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.document.delete({ where: { id: req.params.id } })
    res.json({ message: 'Document deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /:id/share — Generate share link ─────────────────────────────────────
// Creates a signed JWT with type: 'share' encoding { documentId, permission }.
// The shared document route validates this type claim before trusting the payload.
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const { permission } = req.body // 'view' | 'edit'

    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    // type: 'share' separates these from auth tokens (type: 'auth') that carry userId.
    // The /shared/:shareToken route asserts this claim before reading documentId.
    const shareToken = jwt.sign(
      { documentId: req.params.id, permission, type: 'share' },
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

// ── GET /shared/:shareToken — Access shared document ──────────────────────────
// Public route (no auth required). Verifies the share token, checks its type
// claim to prevent auth tokens being used here, and returns document content.
router.get('/shared/:shareToken', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.shareToken, process.env.JWT_SECRET)

    // Reject any token that is not explicitly a share token.
    // This prevents auth tokens (type: 'auth') from being accepted here.
    if (decoded.type !== 'share') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    const { documentId, permission } = decoded

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })

    res.json({ ...document, permission })
  } catch (err) {
    // jwt.verify throws on expired, tampered, or malformed tokens
    res.status(401).json({ error: 'Invalid or expired share link' })
  }
})

// ── VERSION HISTORY ────────────────────────────────────────────────────────────
// Snapshots are point-in-time copies of a document's content and title.

// POST /:id/snapshot — Save current state as a new version.
// The route reads content from the database (not from the request body), so the
// snapshot reflects what is actually persisted — not what the client thinks is saved.
// Callers (Document.jsx saveSnapshot) must successfully complete saveDocument()
// before calling this, and handle that error before calling /snapshot.
router.post('/:id/snapshot', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    // findFirst + create are two operations — wrap in a transaction so a crash
    // between them cannot leave us with a duplicate versionNumber.
    const snapshot = await prisma.$transaction(async (tx) => {
      const lastVersion = await tx.documentVersion.findFirst({
        where:   { documentId: req.params.id },
        orderBy: { versionNumber: 'desc' }
      })
      const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1

      return tx.documentVersion.create({
        data: {
          documentId:    req.params.id,
          versionNumber: newVersionNumber,
          title:         document.title,
          content:       document.content,
          name:          req.body.name || null
        }
      })
    })

    res.status(201).json(snapshot)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /:id/versions — List all version summaries (no content, for the sidebar)
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id }
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (document.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' })

    const versions = await prisma.documentVersion.findMany({
      where:   { documentId: req.params.id },
      select:  { id: true, versionNumber: true, createdAt: true, name: true },
      orderBy: { versionNumber: 'desc' }
    })

    res.json(versions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /:id/versions/:versionId — Get full content of one version (for preview)
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

// POST /:id/versions/:versionId/restore — Roll back document to a saved version.
//
// Uses a single prisma.$transaction to atomically:
//   1. Overwrite the document's content + title
//   2. Create an audit snapshot labelled "Restored from Version N"
//   3. Compute the new versionNumber inside the transaction (no race condition)
//
// Without the transaction, a crash between steps 1 and 2 would leave the
// document restored with no audit record. Two concurrent restores would race
// on the findFirst → create pair and violate the @@unique([documentId, versionNumber])
// constraint.
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

    const updatedDocument = await prisma.$transaction(async (tx) => {
      // Step 1: Restore document content
      const restored = await tx.document.update({
        where: { id: req.params.id },
        data:  { title: version.title, content: version.content }
      })

      // Step 2: Create audit snapshot (inside the same transaction)
      const lastVersion = await tx.documentVersion.findFirst({
        where:   { documentId: req.params.id },
        orderBy: { versionNumber: 'desc' }
      })
      const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1

      await tx.documentVersion.create({
        data: {
          documentId:    req.params.id,
          versionNumber: newVersionNumber,
          title:         version.title,
          content:       version.content,
          name:          `Restored from Version ${version.versionNumber}`
        }
      })

      return restored
    })

    res.json(updatedDocument)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router