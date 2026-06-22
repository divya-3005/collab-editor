// Operation types: { type: 'insert', position, character } 
//                  { type: 'delete', position }

export function transform(op1, op2) {
  // transform op1 assuming op2 has already been applied

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
      return null // already deleted, no-op
    }
    return op1
  }

  return op1
}

export function apply(text, op) {
  if (op === null) return text

  if (op.type === 'insert') {
    return text.slice(0, op.position) + op.character + text.slice(op.position)
  }

  if (op.type === 'delete') {
    return text.slice(0, op.position) + text.slice(op.position + 1)
  }

  return text
}