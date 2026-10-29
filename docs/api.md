# API Documentation

The REST API is built with Express and PostgreSQL via Prisma.

## Authentication Routes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `DELETE` | `/api/auth/me` | Delete current user account |
| `GET` | `/api/auth/google` | Initiate Google OAuth flow |
| `POST` | `/api/auth/google/exchange` | Exchange one-time code for JWT |

## Document Routes

All mutating document routes require a valid JWT `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | List documents owned by user (supports `?page=` and `?limit=`) |
| `POST` | `/api/documents` | Create a new document |
| `POST` | `/api/documents/:id/duplicate` | Duplicate an existing document |
| `GET` | `/api/documents/:id` | Get document metadata and content |
| `PATCH` | `/api/documents/:id` | Update document title or content |
| `DELETE` | `/api/documents/:id` | Delete a document |

## Sharing and Versions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/:id/share` | Generate a signed share link (view or edit) |
| `GET` | `/api/documents/shared/:shareToken` | Fetch a shared document using share JWT |
| `POST` | `/api/documents/:id/snapshot` | Create a snapshot version |
| `GET` | `/api/documents/:id/versions` | List snapshot summaries |
| `GET` | `/api/documents/:id/versions/:versionId` | Get full snapshot content |
| `POST` | `/api/documents/:id/versions/:versionId/restore` | Roll back document to snapshot state |

## Socket Events

The real-time protocol operates over Socket.io.

- **Client to Server:**
  - `join-document`
  - `collab-steps`
  - `collab-catch-up`
  - `cursor-move`
  - `collab-restore`
  - `doc-chat` (broadcasts in-room message to collaborators)
- **Server to Client:**
  - `collab-init`
  - `collab-steps`
  - `collab-sync`
  - `collab-ack`
  - `collab-reset`
  - `user-count`
  - `doc-chat`
