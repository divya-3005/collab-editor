# Architecture Overview

CollabDocs follows a decoupled, hook-based React architecture on the frontend, and a thin Express/Socket.io orchestration layer on the backend.

## Frontend Architecture

The frontend avoids monolithic component structures. The primary `Document.jsx` editor view is a pure presentation component, delegating all logic to custom hooks.

### Core Hooks

- `useDocumentData`: Handles initial fetching from the REST API.
- `useAuthHeaders`: Manages the construction of Authorization headers globally.
- `useCollabSocket`: Owns the Socket.io lifecycle and the ProseMirror step-sync protocol.
- `usePresence`: Tracks connected remote users and cursor metadata.
- `useVersionHistory`: Manages atomic document state restoration.
- `useAutoSave`: Manages background synchronization (`isDirty` tracking, `beforeunload` events) to persist data via REST.

By decoupling these, `Document.jsx` avoids the classic infinite re-render loop often found in React real-time apps. State updates in one domain (e.g. cursor movement) do not trigger re-renders in orthogonal domains (e.g. document title updates).

## Backend Architecture

The backend is built with **Node.js, Express, and Socket.io**.

### Hybrid State Model

CollabDocs uses a hybrid state model:
1. **Real-time State (Volatile)**: WebSockets and an in-memory buffer handle micro-edits (ProseMirror steps). This ensures sub-10ms latency for collaborative typing.
2. **Persistent State (Durable)**: A REST API handles macro-saves (autosave triggers). Every few seconds, the client sends the reconciled document HTML to the server via POST to persist in PostgreSQL.

This hybrid approach prevents the database from being hammered with a query on every single keystroke.

### Security Boundaries
- The REST API is secured via standard `Authorization: Bearer <token>` JWT headers.
- The WebSocket server is secured via an `io.use` middleware that upgrades the connection only if a valid JWT is provided in the handshake auth payload.
