<div align="center">

<br />

<img src="./client/public/logo.svg" width="80" height="80" alt="CollabDocs Logo" />

<h1>CollabDocs</h1>

<p><strong>Real-time collaborative document editing, engineered from scratch.</strong><br />
Multiple users. One document. Zero conflicts.</p>

<br />

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-4f46e5?style=for-the-badge&logo=vercel&logoColor=white)](https://collab-editor-vu93.onrender.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](./LICENSE)

<br />

</div>

---

## ✨ What is CollabDocs?

CollabDocs is a **full-stack real-time collaborative document editor** — think Google Docs, built from the ground up. It supports multiple users editing the same document simultaneously, with conflicts resolved automatically using a custom **Operational Transformation (OT)** algorithm.

No CRDT libraries. No third-party real-time backends. Pure WebSockets + hand-rolled OT.

<br />

## 🚀 Core Features

| Feature | Description |
|---|---|
| ⚡ **Real-Time Collaboration** | Multiple users edit the same document live via Socket.io |
| 🔀 **Operational Transformation** | Custom OT engine resolves concurrent edit conflicts without data loss |
| ✏️ **Rich Text Editor** | Full rich text support via Tiptap / ProseMirror (bold, italic, headings, lists) |
| 🔐 **Dual Authentication** | Email/password auth + Google OAuth 2.0 via Passport.js |
| 🔗 **Secure Sharing** | JWT-signed shareable links with `view` or `edit` permissions |
| 🌓 **Dark Mode** | System-aware dark mode with toggle, persisted to localStorage |
| 🔍 **Document Search** | Live client-side search with highlighted matches |
| 🗑️ **Account Management** | Full account deletion with cascading document cleanup |
| 📱 **Responsive** | Desktop-first, degrades gracefully to mobile |

<br />

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Vercel)                          │
│                                                                 │
│  React + Vite + Tailwind CSS                                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Landing  │  │   Auth    │  │  Dashboard   │  │  Editor  │  │
│  │   Page   │  │   Page    │  │   (Search)   │  │  (Tiptap)│  │
│  └──────────┘  └───────────┘  └──────────────┘  └──────────┘  │
│                                        │               │        │
│                          Axios (REST)  │    Socket.io  │        │
└────────────────────────────────────────┼───────────────┼────────┘
                                         │               │
┌────────────────────────────────────────┼───────────────┼────────┐
│                        SERVER (Render) │               │        │
│                                        ▼               ▼        │
│  Node.js + Express.js         REST API          Socket.io       │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │   Auth Routes    │    │      OT Engine (Server)          │  │
│  │  JWT + Google    │    │  - join-document rooms           │  │
│  │  OAuth via       │    │  - transform() concurrent ops    │  │
│  │  Passport.js     │    │  - broadcast content-update      │  │
│  └──────────────────┘    └──────────────────────────────────┘  │
│             │                           │                        │
│             ▼                           ▼                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Prisma ORM → PostgreSQL                      │  │
│  │  User ──< Document ──< ShareLink                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

<br />

## 🔀 How Operational Transformation Works

This is the most technically interesting part of the project.

When two users type at the same time, their operations can conflict:

```
Initial document: "Hello"

User A types "!" at position 5  →  op_A = { type: 'insert', pos: 5, char: '!' }
User B types " World" at pos 5  →  op_B = { type: 'insert', pos: 5, str: ' World' }
```

Without transformation, one user's edit would silently overwrite the other's. CollabDocs resolves this by **transforming each incoming operation against all concurrent operations** before applying it:

```
transform(op_A, op_B) → op_A' = { type: 'insert', pos: 11, char: '!' }
Result: "Hello World!"  ✓  (both operations preserved)
```

The OT engine lives in [`client/src/ot/transform.js`](./client/src/ot/transform.js) and [`server/src/ot/server.js`](./server/src/ot/server.js).

<br />

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** + **Vite** | UI framework + blazing fast dev server |
| **Tailwind CSS 3** | Utility-first styling with dark mode |
| **Tiptap / ProseMirror** | Rich text editor engine |
| **Socket.io-client** | WebSocket client for real-time sync |
| **React Router v7** | Client-side routing + SPA navigation |
| **Axios** | HTTP client for REST API calls |
| **Lucide React** | Icon system |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js** + **Express 5** | HTTP server + REST API |
| **Socket.io 4** | WebSocket server for real-time events |
| **Prisma ORM 7** | Type-safe database access |
| **PostgreSQL** | Relational database |
| **Passport.js** | Google OAuth 2.0 strategy |
| **jsonwebtoken** | JWT auth for sessions + share links |
| **bcryptjs** | Password hashing |

### Infrastructure
| Service | Role |
|---|---|
| **Vercel** | Frontend hosting (CDN + edge) |
| **Render** | Backend server hosting |
| **Supabase / Render PostgreSQL** | Managed database |

<br />

## 📁 Project Structure

```
collab-editor/
├── client/                        # React frontend (Vite)
│   ├── public/
│   │   └── logo.svg               # SVG logo (transparent, works in dark mode)
│   ├── src/
│   │   ├── context/
│   │   │   └── ThemeContext.jsx   # Dark mode context + localStorage persistence
│   │   ├── ot/
│   │   │   ├── transform.js       # OT transform() and apply() functions
│   │   │   └── transform.test.js  # Unit tests for OT logic
│   │   ├── pages/
│   │   │   ├── Landing.jsx        # Public landing page
│   │   │   ├── Login.jsx          # Auth (email + Google OAuth)
│   │   │   ├── Dashboard.jsx      # Document list + search
│   │   │   ├── Document.jsx       # Real-time editor page
│   │   │   ├── SharedDocument.jsx # Read/edit via share link
│   │   │   └── AuthCallback.jsx   # Google OAuth callback handler
│   │   ├── socket/
│   │   │   └── socket.js          # Socket.io client instance
│   │   ├── App.jsx                # Router + theme provider
│   │   └── index.css              # Design system + Tiptap prose overrides
│   └── vercel.json                # SPA routing config for Vercel
│
└── server/                        # Node.js + Express backend
    ├── prisma/
    │   └── schema.prisma          # Database schema (User, Document, ShareLink)
    ├── src/
    │   ├── middleware/
    │   │   └── auth.js            # JWT authentication middleware
    │   ├── ot/
    │   │   └── server.js          # Server-side OT + Socket.io event handlers
    │   ├── routes/
    │   │   ├── auth.js            # /auth/* — login, register, Google, delete account
    │   │   ├── documents.js       # /documents/* — CRUD + sharing
    │   │   └── googleAuth.js      # Google OAuth Passport strategy
    │   ├── lib/
    │   │   └── prisma.js          # Prisma client singleton
    │   └── index.js               # Express + Socket.io server entry point
    └── docker-compose.yml         # Local PostgreSQL via Docker
```

<br />

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js** v18+
- **Docker** (for local PostgreSQL) — or a PostgreSQL instance

### 1. Clone the repo

```bash
git clone https://github.com/divya-3005/collab-editor.git
cd collab-editor
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Set up the backend

```bash
cd server
npm install

# Copy env and fill in your values
cp .env.example .env

# Push the Prisma schema to the DB
npx prisma db push

# Start the dev server
npm run dev
```

**Required server env vars (`server/.env`):**

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/collabdocs
JWT_SECRET=your_jwt_secret_here
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

### 4. Set up the frontend

```bash
cd ../client
npm install

# Create env file
echo "VITE_API_URL=http://localhost:3001/api" > .env

# Start the dev server
npm run dev
```

Open **http://localhost:5173** — you're live.

<br />

## 🔐 Authentication Flows

```
Email/Password:          Google OAuth:
──────────────           ──────────────
POST /auth/register  →   GET /auth/google
POST /auth/login     →   Google consent screen
       ↓                        ↓
   JWT token          GET /auth/google/callback
       ↓                        ↓
localStorage         POST → JWT token → /auth/callback
       ↓                        ↓
  Protected routes       localStorage → dashboard
```

<br />

## 📡 Real-Time Event Reference

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join-document` | Client → Server | `documentId` | Join a document's Socket.io room |
| `content-update` | Client → Server | `{ documentId, content }` | Broadcast new HTML content |
| `content-update` | Server → Client | `{ content }` | Receive updated content from peers |
| `user-count` | Server → Client | `number` | Number of active editors in the room |
| `document-revision` | Server → Client | `{ revision }` | Current document revision number |
| `operation-ack` | Server → Client | `{ revision }` | OT operation acknowledged |

<br />

## 🗄️ Database Schema

```prisma
model User {
  id        String     @id @default(uuid())
  name      String
  email     String     @unique
  password  String?
  googleId  String?    @unique
  documents Document[] @relation("owner")
  createdAt DateTime   @default(now())
}

model Document {
  id         String      @id @default(uuid())
  title      String      @default("Untitled Document")
  content    String?     @default("")
  owner      User        @relation("owner", fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId    String
  shareLinks ShareLink[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model ShareLink {
  id         String   @id @default(uuid())
  token      String   @unique
  permission String   @default("view")   // "view" | "edit"
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  documentId String
  createdAt  DateTime @default(now())
}
```

<br />

## 🌐 Deployment

| Layer | Platform | Notes |
|---|---|---|
| Frontend | **Vercel** | Auto-deploys from `main` branch. `vercel.json` handles SPA routing. |
| Backend | **Render** | Web service. Set all env vars in Render dashboard. |
| Database | **Render PostgreSQL** | Managed Postgres. Set `DATABASE_URL` accordingly. |

### Vercel env vars (frontend)
```
VITE_API_URL = https://your-render-app.onrender.com/api
```

### Render env vars (backend)
```
DATABASE_URL         = postgresql://...
JWT_SECRET           = ...
CLIENT_URL           = https://your-vercel-app.vercel.app
GOOGLE_CLIENT_ID     = ...
GOOGLE_CLIENT_SECRET = ...
GOOGLE_CALLBACK_URL  = https://your-render-app.onrender.com/api/auth/google/callback
```

> **Important:** Google Cloud Console → OAuth 2.0 → Authorized redirect URIs must include your production `GOOGLE_CALLBACK_URL` exactly.

<br />

## 🧪 Testing

The OT transform logic has unit tests:

```bash
cd client
node src/ot/transform.test.js
```

Tests cover insert/delete transforms, identity operations, and concurrent conflict resolution.

<br />

## 📝 License

MIT © [Divya Singh](https://github.com/divya-3005)

---

<div align="center">

Built with ❤️ using React, Socket.io, and a custom Operational Transformation engine.

**[⭐ Star this repo](https://github.com/divya-3005/collab-editor)** if you found it useful!

</div>
