# CollabDocs

A real-time collaborative document editor that allows multiple users to edit the same document concurrently without conflicts, featuring Google Authentication, document sharing with permissions, and a beautiful UI.

![CollabDocs Screenshot](./screenshot.png) <!-- Note: Replace with actual screenshot later -->

## Features

- **Real-Time Collaboration**: Built with Socket.io and a custom Operational Transformation (OT) algorithm to resolve edit conflicts instantly.
- **Rich Text Editing**: Powered by Tiptap, a headless wrapper around ProseMirror.
- **Authentication**: Local email/password auth + Google OAuth using Passport.js.
- **Document Management**: Create, edit, delete, and view your documents in a clean Dashboard.
- **Secure Sharing**: Generate signed JWT links to share documents with specific permissions (`view-only` or `edit`).
- **Responsive UI**: Styled with Tailwind CSS, ensuring a great experience across devices.
- **Polished UX**: `react-hot-toast` notifications and smooth routing.

## Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- Tiptap (Rich Text Editor)
- Socket.io-client
- React Router DOM
- Axios

### Backend
- Node.js & Express.js
- Socket.io (WebSockets)
- Prisma (ORM)
- PostgreSQL
- Passport.js (Google OAuth & JWT)
- jsonwebtoken

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or Docker to run the database)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/collab-editor.git
   cd collab-editor
   ```

2. **Start the database:**
   If you have Docker installed, you can easily spin up the Postgres DB:
   ```bash
   docker compose up -d
   ```

3. **Backend Setup:**
   ```bash
   cd server
   npm install
   
   # Copy the example env file and fill in your details
   cp .env.example .env
   
   # Run Prisma migrations
   npx prisma migrate dev
   
   # Start the development server
   npm run dev
   ```

4. **Frontend Setup:**
   ```bash
   cd ../client
   npm install
   
   # Copy the example env file
   cp .env.example .env
   
   # Start the React app
   npm run dev
   ```

The application will now be running. The client is typically at `http://localhost:5173` and the server at `http://localhost:3001`.

## Environment Variables

Check `.env.example` in both `client/` and `server/` directories.

**Server (`server/.env`)**
- `PORT`: Server port (default 3001)
- `DATABASE_URL`: Postgres connection string
- `JWT_SECRET`: Secret key for signing tokens
- `CLIENT_URL`: URL of the frontend (e.g., `http://localhost:5173`)
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google OAuth login

**Client (`client/.env`)**
- `VITE_API_URL`: Backend API URL (default `http://localhost:3001/api`)

## Operational Transformation (OT)
This application implements an OT system to ensure that when two users edit the same document at the exact same time, their changes are transformed against the document's history to prevent overriding each other's work.

## License

MIT License
