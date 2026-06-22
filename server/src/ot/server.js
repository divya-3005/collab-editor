// Server-side OT state per document
// Keeps operation history to transform late-arriving operations

const documentStates = new Map()

export function getDocumentState(documentId) {
  if (!documentStates.has(documentId)) {
    documentStates.set(documentId, {
      revision: 0,
      operations: [] // full history
    })
  }
  return documentStates.get(documentId)
}

export function transformAgainstHistory(op, fromRevision, documentId) {
  const state = getDocumentState(documentId)
  
  // get all operations that happened after the client's revision
  const concurrentOps = state.operations.slice(fromRevision)
  
  let transformed = op
  for (const historyOp of concurrentOps) {
    transformed = transform(transformed, historyOp)
    if (transformed === null) return null // op became a no-op
  }
  
  return transformed
}

export function applyOperation(op, documentId) {
  const state = getDocumentState(documentId)
  state.operations.push(op)
  state.revision++
  return state.revision
}

// same transform logic as client — must stay identical
function transform(op1, op2) {
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op2.position <= op1.position) {
      return { ...op1, position: op1.position + 1 }
    }
    return op1
  }

  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op2.position < op1.position) {
      return { ...op1, position: op1.position - 1 }
    }
    return op1
  }

  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op2.position <= op1.position) {
      return { ...op1, position: op1.position + 1 }
    }
    return op1
  }

  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op2.position < op1.position) {
      return { ...op1, position: op1.position - 1 }
    }
    if (op2.position === op1.position) {
      return null
    }
    return op1
  }

  return op1
}