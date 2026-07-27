# Collaboration Engine

The collaboration engine allows multiple users to edit the same document concurrently without data loss or cursor jumping.

## The Problem with Character-based OT

Previously, the editor attempted to synchronize using a custom Character-based Operational Transformation algorithm. However, rich-text editors (like Tiptap/ProseMirror) use a tree-based document model, not a flat string. Character-based OT cannot represent structural changes like wrapping a paragraph in a blockquote or converting a node into a list. This led to silent data corruption.

## The Solution: ProseMirror Step Sync

CollabDocs now uses ProseMirror's native central-authority collaborative editing protocol via `@tiptap/pm/collab`.

### How it works

1. **Local Changes**: When User A types, Tiptap generates a `Step` (e.g. `ReplaceStep`, `AddMarkStep`). 
2. **Buffer**: The step is applied locally immediately for a zero-latency feel, but remains unconfirmed.
3. **Emit**: The client emits `collab-steps` to the server containing an array of serialized steps and the local document version.
4. **Sequencing (Server)**: The server acts as a pure sequencer. It verifies the incoming version matches its current version. If it does, the server increments its version, buffers the steps in memory, and broadcasts `collab-steps` to all other peers.
5. **Rebasing (Client)**: When User B receives User A's steps, ProseMirror's `receiveTransaction` applies the remote steps, and *rebases* any unconfirmed local steps User B has on top of them using the internal `Mapping` system.

### Reconnect Flow

If a client disconnects, they track their last known version. Upon reconnecting, they emit a `collab-catch-up` event. The server responds with `collab-sync`, containing all steps that occurred while the client was offline, allowing seamless catch-up.
