<div align="center">
  <img src="https://via.placeholder.com/150?text=CollabDocs+Logo" alt="CollabDocs Logo" width="120" />
  <h1>CollabDocs</h1>
  <p>A production-ready, real-time collaborative rich-text editor.</p>

  <p>
    <a href="https://collabdocs-demo.example.com">View Demo</a> · 
    <a href="https://github.com/yourusername/collabdocs/issues">Report Bug</a> · 
    <a href="https://github.com/yourusername/collabdocs/issues">Request Feature</a>
  </p>
</div>

---

## 📖 Overview

CollabDocs is a high-performance, real-time collaborative text editor built with **React, Tiptap, Node.js, Express, Socket.io, and PostgreSQL**. 

Designed as a modern alternative to Google Docs, it leverages the **ProseMirror step-based Operational Transformation (OT)** algorithm to guarantee conflict-free, concurrent rich-text editing with zero data corruption. 

It is designed for production with defense-in-depth security, strict type validations, REST API autosave durability, and a decoupled React hook architecture.

<div align="center">
  <img src="https://via.placeholder.com/800x450?text=App+Screenshot" alt="CollabDocs Screenshot" width="800" />
</div>

## ✨ Features

- **Real-Time Collaboration**: Sub-10ms latency updates via WebSockets.
- **Conflict-Free Edits**: ProseMirror's central-authority step rebasing handles concurrent formatting (bolding, lists, headings) gracefully.
- **Live Presence**: Multi-colored remote cursors with user identification.
- **Snapshot Versioning**: Save, preview, and atomically restore historical document states.
- **Secure Sharing**: Generate view-only or edit-enabled share links.
- **Robust Security**: Strict JWT type segregation (Auth vs Share tokens), XSS HTML sanitization, rate limiting, and backend-to-frontend OAuth token exchanges.

## 🛠 Technology Stack

**Frontend**
- React 19
- Vite
- Tiptap / ProseMirror (`@tiptap/react`, `prosemirror-collab`)
- Tailwind CSS
- React Router DOM

**Backend**
- Node.js & Express
- Socket.io (Real-time engine)
- Prisma ORM
- PostgreSQL
- Passport.js (Google OAuth 2.0)

## 🚀 Installation & Local Development

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/collabdocs.git
cd collabdocs
```

### 2. Configure Environment
Copy the example environment file and fill in your secrets (Database URL, Google OAuth credentials, and a secure JWT secret).
```bash
cp server/.env.example server/.env
```
> **Note**: The backend will deliberately refuse to start if `JWT_SECRET` or `DATABASE_URL` are missing or malformed to prevent insecure boots.

### 3. Install Dependencies
```bash
# In the client directory
cd client
npm install

# In the server directory
cd ../server
npm install
```

### 4. Database Setup
Ensure PostgreSQL is running locally, then push the Prisma schema:
```bash
npx prisma db push
```

### 5. Start Development Servers
Start both the client and server concurrently.
```bash
# Client (Terminal 1)
cd client
npm run dev

# Server (Terminal 2)
cd server
npm run dev
```

The application will be available at `http://localhost:5173`.

## 🏗 Architecture & Internal Documentation

CollabDocs avoids spaghetti state by heavily decoupling logic into focused modules. Read the detailed documentation in the `/docs` folder:

- [Frontend Hook Architecture](docs/architecture.md)
- [ProseMirror Step-Sync Protocol](docs/collaboration.md)
- [Security Model & Threat Mitigation](docs/security.md)
- [REST API & Socket Events](docs/api.md)
- [Database Schema](docs/database.md)
- [Deployment Guide & Horizontal Scaling Constraints](docs/deployment.md)

## 🐳 Docker (Optional)
*A `Dockerfile` and `docker-compose.yml` are planned for v1.1.0 to streamline local database and server orchestration.*

## 🧪 Testing
The server includes native Node.js tests for critical security utilities (like the HTML sanitizer).
```bash
cd server
npm run test
```

## 📈 Future Roadmap
- [ ] Guest anonymous JWT issuing for shared links.
- [ ] Redis Pub/Sub adapter for multi-node horizontal scaling.
- [ ] Client-side cursor throttle tuning based on network latency.
- [ ] Export to PDF / Markdown functionality.

## 🤝 Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.
Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## 🛡 License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## 🙏 Acknowledgements
- [Tiptap](https://tiptap.dev/) & [ProseMirror](https://prosemirror.net/) for the incredible editing framework.
- [Socket.io](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)
