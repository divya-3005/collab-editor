# API Documentation

The CollabDocs API is a standard RESTful service built with Express.

## Authentication Routes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/auth/me` | Get current user profile |
| `DELETE` | `/api/auth/me` | Delete current user account |
| `GET` | `/api/auth/google` | Initiate Google OAuth flow |
| `POST` | `/api/auth/google/exchange` | Exchange one-time code for JWT |

## Document Routes

All document routes require a valid JWT `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | List all documents owned or shared |
| `POST` | `/api/documents` | Create a new document |
| `GET` | `/api/documents/:id` | Get document data and content |
| `PUT` | `/api/documents/:id` | Update document title or content |
| `DELETE` | `/api/documents/:id` | Delete a document |

## Sharing and Versions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/:id/share` | Generate a share link |
| `GET` | `/api/documents/shared/:shareToken` | Fetch a document via share token |
| `POST` | `/api/documents/:id/versions` | Create a snapshot |
| `GET` | `/api/documents/:id/versions` | List all snapshots |
| `POST` | `/api/documents/:id/restore` | Restore a specific snapshot |

## Socket Events

The real-time protocol operates over Socket.io.

- **Client to Server:**
  - `join-document`
  - `collab-steps`
  - `collab-catch-up`
  - `cursor-move`
  - `collab-restore`
- **Server to Client:**
  - `collab-init`
  - `collab-steps`
  - `collab-sync`
  - `collab-ack`
  - `collab-reset`
  - `user-count`
