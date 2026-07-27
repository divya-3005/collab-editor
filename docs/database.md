# Database Schema

CollabDocs uses **PostgreSQL** as its primary datastore, managed via **Prisma ORM**.

## Models

### User
Stores registered users. Passwords are encrypted using `bcrypt`.
- Relations: `Document` (owner), `DocumentShare` (collaborator)

### Document
The core entity representing a text file.
- **Fields**: `id`, `title`, `content` (HTML string), `createdAt`, `updatedAt`, `ownerId`.
- The `content` field represents the durable macro-state of the document. Micro-states (ProseMirror steps) are held in memory by the Node server and flushed to this field via the autosave loop.

### DocumentVersion
Represents a historical snapshot of a document.
- Created when a user clicks "Save Snapshot".
- Restoring a version overwrites the parent `Document.content` within an atomic `prisma.$transaction`.

### DocumentShare
Represents access control for guest collaborators.
- **Permissions**: `view` or `edit`.
- Share tokens embed the `id` of this model to verify access upon decryption.

## Migrations

The project does not currently track migration histories (no `prisma/migrations` folder) to keep development iteration fast. 
Use `npx prisma db push` to synchronize the schema during local development. For production deployments, a formal migration system (`npx prisma migrate dev`) should be adopted.
