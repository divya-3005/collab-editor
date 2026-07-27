/**
 * collab.js — Server-side collaboration step sequencer.
 *
 * Why this replaces the character-OT engine:
 *   The previous engine (ot/server.js + ot/transform.js) assumed a flat,
 *   plain-text string model: operations were { type: 'insert'|'delete', position, character }.
 *   Tiptap uses ProseMirror, whose document model is a typed node tree where:
 *     - Positions count both characters AND node open/close tokens.
 *     - A single user action can produce AddMarkStep, ReplaceAroundStep,
 *       AttrStep, etc. — none of which map to insert/delete on a flat string.
 *   The character-OT engine was therefore incapable of correctly transforming
 *   any rich-text operation (bold, headings, lists, blockquotes, links, etc.).
 *
 * New architecture:
 *   The server is a pure step sequencer. It does NOT interpret ProseMirror step
 *   content — it only assigns monotonically increasing version numbers to step
 *   batches and relays them to peers in the correct order.
 *
 *   Conflict resolution (OT) happens entirely on the client using ProseMirror's
 *   own @tiptap/pm/collab utilities (sendableSteps + receiveTransaction), which
 *   correctly transform all ProseMirror step types using ProseMirror's Mapping
 *   system. This is the correct tool for the job: ProseMirror's mapping accounts
 *   for node tokens in its position arithmetic, which our ±1 arithmetic did not.
 *
 * Protocol:
 *   - Client sends: { documentId, version, steps: StepJSON[], clientID }
 *   - If client.version === server.version → accept steps, increment version,
 *     broadcast to peers, ack the sender.
 *   - If client.version < server.version → reject, send missing steps so the
 *     client can rebase its pending steps and retry.
 *
 * Persistence:
 *   Steps are stored in-memory for the duration of a session. The REST autosave
 *   (PATCH /api/documents/:id every 3 seconds) persists the full document HTML
 *   to Postgres, providing durable recovery without requiring the server to
 *   interpret or store individual steps. On a server restart, clients reconnect
 *   and fetch the latest document content via the REST API.
 *
 *   The in-memory step buffer (MAX_STEPS_PER_DOC) allows clients that briefly
 *   disconnect (network blip, tab sleep) to catch up without a full reload,
 *   while bounding memory growth per document.
 */

// Maximum steps to keep in memory per document.
// Steps older than this are evicted. A client whose last known version is before
// the oldest buffered step will receive a 'collab-full-sync' event instructing
// it to reload the document content from the REST API instead.
const MAX_STEPS_PER_DOC = 500

// Map<documentId, CollabState>
const documentStates = new Map()

/**
 * @typedef {Object} CollabState
 * @property {number}   version   - Monotonically increasing. Incremented once per
 *                                  accepted step batch from any client.
 * @property {Array}    steps     - Circular buffer of { version, step, clientID }
 * @property {number}   baseVersion - The version number of the oldest step in the buffer.
 */

/**
 * Returns (lazily creating) the collaboration state for a document.
 * @param {string} documentId
 * @returns {CollabState}
 */
export function getCollabState(documentId) {
  if (!documentStates.has(documentId)) {
    documentStates.set(documentId, {
      version:     0,
      steps:       [], // Array of { step: StepJSON, clientID }
      baseVersion: 0   // version at which the steps array starts
    })
  }
  return documentStates.get(documentId)
}

/**
 * Append a batch of steps and advance the document version.
 * Each step in the batch is stored with its clientID for replay.
 *
 * @param {string}   documentId
 * @param {object[]} steps      — Serialized ProseMirror step JSON objects
 * @param {string}   clientID   — The socket/client identifier (for collab plugin)
 * @returns {number} New version number after the steps are applied
 */
export function addSteps(documentId, steps, clientID) {
  const state = getCollabState(documentId)

  for (const step of steps) {
    state.steps.push({ step, clientID })
  }

  state.version += steps.length

  // Prune oldest steps if the buffer exceeds the cap.
  // baseVersion tracks the version of the first entry so getStepsSince
  // can compute correct slices after pruning.
  if (state.steps.length > MAX_STEPS_PER_DOC) {
    const pruneCount = state.steps.length - MAX_STEPS_PER_DOC
    state.steps = state.steps.slice(pruneCount)
    state.baseVersion += pruneCount
  }

  return state.version
}

/**
 * Return all steps committed after `fromVersion`.
 *
 * If `fromVersion` is before `state.baseVersion` (the oldest buffered step),
 * returns an empty steps array and sets `needsFullSync = true` to signal that
 * the client must reload the full document from the REST API.
 *
 * @param {string} documentId
 * @param {number} fromVersion
 * @returns {{ steps: object[], clientIDs: string[], currentVersion: number, needsFullSync: boolean }}
 */
export function getStepsSince(documentId, fromVersion) {
  const state = getCollabState(documentId)

  if (fromVersion >= state.version) {
    // Client is already up to date
    return {
      steps:          [],
      clientIDs:      [],
      currentVersion: state.version,
      needsFullSync:  false
    }
  }

  if (fromVersion < state.baseVersion) {
    // Client is too far behind — the steps it needs have been pruned.
    // Signal a full document reload.
    return {
      steps:          [],
      clientIDs:      [],
      currentVersion: state.version,
      needsFullSync:  true
    }
  }

  // Slice out the steps since fromVersion.
  // steps[i] corresponds to version (baseVersion + i + 1).
  // To get steps after fromVersion: start at (fromVersion - baseVersion).
  const sliceStart = fromVersion - state.baseVersion
  const relevant   = state.steps.slice(sliceStart)

  return {
    steps:          relevant.map(e => e.step),
    clientIDs:      relevant.map(e => e.clientID),
    currentVersion: state.version,
    needsFullSync:  false
  }
}

/**
 * Remove the in-memory state for a document.
 * Called when a document's room becomes empty to free memory.
 * (Currently not wired up — documents are cheap to keep cached.
 *  Add cleanup logic here if memory pressure becomes a concern.)
 *
 * @param {string} documentId
 */
export function evictDocument(documentId) {
  documentStates.delete(documentId)
}
