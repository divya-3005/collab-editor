# CollabDocs — Real-Time Collaborative Rich-Text Editor

A full-stack, real-time collaborative document editor inspired by Google Docs and Notion. Built from scratch to explore distributed state synchronization, Operational Transformation (OT) in rich-text trees, and WebSocket architectures.

Developed by **Divya Singh** as an engineering deep dive into real-time systems.

---

## 💡 Why I Built This

Most collaborative editor tutorials implement naive string operations (`insert(index, char)` / `delete(index)`) over WebSockets or simple last-write-wins broadcasts. However, real-world rich-text editors (like Google Docs or Notion) represent documents as hierarchical node trees (paragraphs, lists, headings, inline marks) where simple string offsets break down immediately.

I built CollabDocs to tackle the real challenges of collaborative software:
1. **Rich-Text Concurrency**: Implementing ProseMirror's central-authority step rebasing protocol so concurrent formatting and structural edits never corrupt the document tree.
2. **State Decoupling in React**: Structuring complex editor state into focused hooks so high-frequency cursor updates and step sync never trigger full editor re-renders.
3. **Hybrid Persistence Architecture**: Combining in-memory ring buffers for low-latency socket relay with debounced REST autosave to PostgreSQL for long-term durability.
4. **Application Security**: Hardening rich-text inputs against XSS attacks, preventing JWT privilege confusion, and securing OAuth flows against credential leakage.

---

## ✨ Features

- **Concurrent Multi-User Editing**: Multiple collaborators can edit the same document simultaneously with conflict-free step rebasing via WebSockets.
- **Live Remote Cursors & Presence**: Visualizes remote collaborators' cursors, selection points, and names in real time using ProseMirror DOM decorations.
- **Real-Time Room Chat**: In-document discussion panel allowing collaborators to communicate in real time during editing sessions.
- **Snapshot Version History & Rollback**: Create point-in-time document snapshots, preview historical versions in read-only mode, and perform atomic rollbacks via PostgreSQL transactions.
- **Document Export**: One-click export to Markdown (`.md`), Plain Text (`.txt`), HTML (`.html`), or Print/PDF.
- **Document Organization**: Card Grid vs. Table List views, Starred favorites filter, and one-click document duplication.
- **Live Document Metrics**: Live word count, character count, and estimated reading time statistics.
- **Zen Focus Mode & Keyboard Shortcuts**: Distraction-free full-screen writing view and interactive shortcuts cheat sheet (`?`).
- **Granular Document Sharing**: Generate view-only or edit-enabled share links protected by distinct JWT type claims, with full guest collaboration support.
- **Autosave & Unsaved Changes Guard**: Debounced background persistence to PostgreSQL with dirty-state tracking and `beforeunload` warnings.
- **Google OAuth 2.0 & Email/Password Auth**: Secure user authentication supporting both Google sign-in (via one-time exchange codes) and bcrypt-hashed password credentials.
- **Dark / Light Mode**: Clean, distraction-free interface built with Tailwind CSS.

---

## 🏛️ System Architecture

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                        React Client                         │
 │                                                             │
 │   Tiptap / ProseMirror Editor                               │
 │   ├── prosemirror-collab  ── (local unconfirmed steps)       │
 │   └── LiveCursors Plugin  ── (remote cursor decorations)   │
 └──────────────┬──────────────────────────────┬───────────────┘
                │                              │
         Socket.io (Steps)               REST (Autosave / CRUD)
                │                              │
                ▼                              ▼
 ┌──────────────────────────────┐    ┌───────────────────────────┐
 │   Node.js / Express Server   │    │  Express REST Controller  │
 │                              │    │                           │
 │   Central Step Sequencer     │    │  • Document CRUD          │
 │   • Assigns version numbers  │    │  • Version Snapshots      │
 │   • Broadcasts to peers      │    │  • HTML Sanitizer (XSS)   │
 │   • In-memory ring buffer    │    │  • Share Link Tokens      │
 └──────────────────────────────┘    └─────────────┬─────────────┘
                                                   │
                                            Prisma ORM
                                                   │
                                                   ▼
                                     ┌───────────────────────────┐
                                     │    PostgreSQL Database    │
                                     │                           │
                                     │  • Users                  │
                                     │  • Documents              │
                                     │  • DocumentVersions       │
                                     └───────────────────────────┘
```

### 1. Central-Authority Step Sequencing
- When User A types, ProseMirror generates an atomic `Step` (e.g. `ReplaceStep`, `AddMarkStep`).
- The step is applied optimistically to User A's editor view while pending confirmation.
- The client emits `collab-steps` with its current version number to the server.
- The server acts as an authoritative sequencer: if the client's version matches current server state, the server appends the steps, increments the document version, and broadcasts them to peers.
- If the version is stale (another peer submitted first), the server asks the client to catch up; the client fetches the missing steps, rebases its pending local steps on top of them via `receiveTransaction()`, and retries.

### 2. Decoupled Frontend Hook Pipeline
To avoid the infinite re-render loops common in complex React real-time apps, `Document.jsx` delegates responsibilities across modular custom hooks:
- `useDocumentData`: Initial document REST fetch and title state.
- `useCollabSocket`: Socket.io lifecycle, connection state, and ProseMirror step dispatch.
- `usePresence`: Tracks connected remote peers, cursor coordinates, and label auto-hide timers.
- `useAutoSave`: Debounced background persistence, keyboard shortcut (⌘S / Ctrl+S), and dirty state tracking.
- `useVersionHistory`: Snapshot capture, read-only preview mode, and atomic rollbacks.

### 3. Security & Data Protection
- **XSS Allowlist Sanitization**: Rich-text HTML inputs are validated through a strict server-side allowlist (`utils/sanitize.js`) before database writes, stripping `<script>` tags, inline event listeners (`onclick`), and dangerous schemes (`javascript:`).
- **JWT Claim Segregation**: Auth tokens (`type: 'auth'`) and share tokens (`type: 'share'`) are cryptographically distinct. The WebSocket middleware and protected routes reject share tokens to prevent unauthorized account access.
- **Secure OAuth Exchange**: Google OAuth uses a short-lived, single-use server exchange code rather than exposing JWTs in URL query parameters.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Tiptap / ProseMirror (`@tiptap/react`, `prosemirror-collab`), Vite, Tailwind CSS, Lucide Icons, Axios, React Hot Toast
- **Backend**: Node.js, Express, Socket.io, Prisma ORM, Passport.js (Google OAuth 2.0), bcryptjs, jsonwebtoken, Helmet, express-rate-limit
- **Database**: PostgreSQL
- **Testing & Tooling**: Node.js test runner (`node:test`), Docker Compose

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (local instance or hosted database like Supabase / Neon / Railway)
- (Optional) Docker & Docker Compose

### 1. Clone the repository
```bash
git clone https://github.com/divya-3005/collab-editor.git
cd collab-editor
```

### 2. Configure Environment Variables
Copy the example environment file for the server:
```bash
cp server/.env.example server/.env
```

Configure `server/.env`:
```env
PORT=3001
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://username:password@localhost:5432/collabdocs?schema=public"
JWT_SECRET="your-32-character-or-longer-secret-key-here"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"
```

Configure `client/.env` (optional, defaults to `http://localhost:3001/api`):
```env
VITE_API_URL=http://localhost:3001/api
```

### 3. Install Dependencies & Set Up Database
```bash
# Setup server
cd server
npm install
npx prisma db push

# Setup client
cd ../client
npm install
```

### 4. Run the Development Servers
Open two terminal tabs:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser. Open a second browser window (or incognito) to test multi-user real-time collaboration.

### 🐳 Running with Docker Compose (Alternative)
If you have Docker installed:
```bash
docker compose up --build
```

---

## 🧪 Testing

Run server unit tests (including HTML sanitization security tests):
```bash
cd server
npm test
```

---

## 📝 Key Learnings & Takeaways

- **Operational Transformation is inherently tied to the document model**: Attempting to treat rich text as a sequence of character insertions and deletions inevitably fails when users apply bolding, create headings, or manipulate lists. Tying the synchronization protocol to ProseMirror's native `Step` abstractions provides robust, mathematically sound convergence.
- **Separation between volatile collaboration and persistent storage**: A high-performance real-time app cannot execute database writes on every keystroke. Using in-memory ring buffers for low-latency WebSocket step relays combined with debounced REST autosaves provides both sub-10ms editing and reliable durability.
- **Careful transaction boundaries in relational stores**: Rollbacks and snapshot creation must be atomic. Wrapping version updates and audit snapshot writes in Prisma transactions (`tx`) eliminated race conditions and duplicate version constraints.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
