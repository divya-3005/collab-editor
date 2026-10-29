/**
 * collab.js — Server-side ProseMirror collaboration step sequencer.
 *
 * Implements a central-authority sequencing model:
 * - The server does not execute or interpret ProseMirror step content.
 * - It assigns monotonic version numbers to incoming step batches and relays
 *   them to connected peers in arrival order.
 * - If a client submits steps against an outdated version, the server rejects
 *   the submission and provides the missing steps so the client can rebase.
 * - Steps are buffered in-memory for active sessions, while durable document
 *   snapshots are persisted to PostgreSQL via autosave.
 */

// Maximum steps to keep in memory per document.
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
