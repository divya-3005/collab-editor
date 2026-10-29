# Collaboration Engine

The collaboration engine allows multiple users to edit the same document concurrently without data loss or cursor jumping.

## Why Step-Based OT Over Character-Based OT

Rich-text editors (such as ProseMirror and Tiptap) represent documents as a hierarchical node tree rather than a flat string. Traditional character-based Operational Transformation (operating strictly on `{ insert, delete, index }`) cannot correctly represent structural mutations such as adding marks (bold, italic), wrapping blocks in lists or blockquotes, or updating node attributes.

By leveraging ProseMirror's step-based collaboration model (`prosemirror-collab`), edits are represented as atomic `Step` objects that transform cleanly using ProseMirror's internal position mapping system.

## Collaboration Architecture

The editor uses a central-authority step synchronization protocol:

### How it works

1. **Local Changes**: When User A types, Tiptap generates a `Step` (e.g. `ReplaceStep`, `AddMarkStep`). 
2. **Buffer**: The step is applied locally immediately for a zero-latency feel, but remains unconfirmed.
3. **Emit**: The client emits `collab-steps` to the server containing an array of serialized steps and the local document version.
4. **Sequencing (Server)**: The server acts as a pure sequencer. It verifies the incoming version matches its current version. If it does, the server increments its version, buffers the steps in memory, and broadcasts `collab-steps` to all other peers.
5. **Rebasing (Client)**: When User B receives User A's steps, ProseMirror's `receiveTransaction` applies the remote steps, and *rebases* any unconfirmed local steps User B has on top of them using the internal `Mapping` system.

### Reconnect Flow

If a client disconnects, they track their last known version. Upon reconnecting, they emit a `collab-catch-up` event. The server responds with `collab-sync`, containing all steps that occurred while the client was offline, allowing seamless catch-up.
