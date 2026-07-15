/**
 * Operational Transformation (OT) — server-side state manager.
 *
 * What is OT?
 *   When two users edit a document simultaneously, their changes can conflict.
 *   OT resolves conflicts by mathematically adjusting each operation's position
 *   so that all clients converge to the same final document, regardless of the
 *   order in which operations arrive.
 *
 *   This is the same technique used by Google Docs, Etherpad, and others.
 *
 * How this module works:
 *   1. Every document has an in-memory "state" tracking its current revision
 *      number and a full history of applied operations.
 *   2. When an operation arrives from a client it includes the `revision` the
 *      client was on when it made the edit.
 *   3. We slice the history to get every op that was applied *after* that
 *      revision, then transform our incoming op against each one in turn.
 *   4. The transformed op is applied to the server state and broadcast to peers.
 *
 * Supported operation types: "insert" | "delete"
 * Each operation: { type, position, char? }
 */

// ── In-memory store ───────────────────────────────────────────────────────────
// A Map from documentId → { revision: number, operations: Op[], baseRevision: number }
// This is intentionally in-memory: documents are also persisted to Postgres via
// the REST API (auto-save every 3 seconds on the client side).
const documentStates = new Map();

// Maximum number of operations to keep in memory per document.
// Once exceeded, the oldest half is pruned and revision numbers are rebased.
const MAX_HISTORY_SIZE = 1000;

/**
 * Returns (or lazily creates) the OT state for a given document.
 * @param {string} documentId
 * @returns {{ revision: number, operations: object[] }}
 */
export function getDocumentState(documentId) {
  if (!documentStates.has(documentId)) {
    documentStates.set(documentId, {
      revision: 0,
      operations: [],   // full history — needed to transform late-arriving ops
      baseRevision: 0   // tracks how many ops have been pruned from the front
    });
  }
  return documentStates.get(documentId);
}

/**
 * Transforms `op` against all operations that were applied to the document
 * after the client's `fromRevision`. Returns the adjusted operation, or null
 * if it became a no-op (e.g. the character was already deleted by a peer).
 *
 * @param {object} op           - The incoming operation from the client
 * @param {number} fromRevision - The revision the client was on when it sent `op`
 * @param {string} documentId
 * @returns {object|null}
 */
export function transformAgainstHistory(op, fromRevision, documentId) {
  const state = getDocumentState(documentId);

  // Adjust for pruned history: the client's revision may reference ops that
  // have been trimmed. In that case, transform against everything we still have.
  const adjustedIndex = Math.max(0, fromRevision - state.baseRevision);

  // These are the ops our client didn't know about when it made its edit
  const concurrentOps = state.operations.slice(adjustedIndex);

  let transformed = op;
  for (const historyOp of concurrentOps) {
    transformed = transform(transformed, historyOp);
    if (transformed === null) return null; // became a no-op, stop early
  }

  return transformed;
}

/**
 * Appends an (already-transformed) operation to the document history,
 * increments the revision counter, and returns the new revision number.
 *
 * @param {object} op
 * @param {string} documentId
 * @returns {number} new revision
 */
export function applyOperation(op, documentId) {
  const state = getDocumentState(documentId);
  state.operations.push(op);
  state.revision++;

  // Prune old history to prevent unbounded memory growth.
  // When the array exceeds the cap, discard the oldest half.
  if (state.operations.length > MAX_HISTORY_SIZE) {
    const pruneCount = Math.floor(MAX_HISTORY_SIZE / 2);
    state.operations = state.operations.slice(pruneCount);
    state.baseRevision += pruneCount;
  }

  return state.revision;
}

// ── Core transform function ───────────────────────────────────────────────────
// Adjusts op1's position assuming op2 was already applied to the document.
// The logic must stay identical to the client-side transform (ot/client.js).
function transform(op1, op2) {

  // insert vs insert:
  //   If op2 inserted *before or at* op1's position, op1's position shifts right.
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op2.position <= op1.position) {
      return { ...op1, position: op1.position + 1 };
    }
    return op1;
  }

  // insert vs delete:
  //   If op2 deleted a character *before* op1's insert position, shift left.
  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op2.position < op1.position) {
      return { ...op1, position: op1.position - 1 };
    }
    return op1;
  }

  // delete vs insert:
  //   If op2 inserted before op1's delete position, the target character
  //   shifted right, so adjust accordingly.
  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op2.position <= op1.position) {
      return { ...op1, position: op1.position + 1 };
    }
    return op1;
  }

  // delete vs delete:
  //   If op2 deleted *before* op1's position, the target shifted left.
  //   If op2 deleted the *same* position, the character is already gone → no-op.
  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op2.position < op1.position) {
      return { ...op1, position: op1.position - 1 };
    }
    if (op2.position === op1.position) {
      return null; // both clients deleted the same character — nothing left to do
    }
    return op1;
  }

  return op1;
}