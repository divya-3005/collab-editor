import { transform, apply } from './transform.js'

// test apply
console.assert(apply("Hello", { type: 'insert', position: 2, character: 'X' }) === "HeXllo", "insert failed")
console.assert(apply("Hello", { type: 'delete', position: 3 }) === "Helo", "delete failed")
// insert vs insert — op2 before op1, shift op1 right
const t1 = transform(
  { type: 'insert', position: 3, character: 'B' },
  { type: 'insert', position: 1, character: 'A' }
)
console.assert(t1.position === 4, `insert vs insert (before): expected 4 got ${t1.position}`)

// insert vs insert — op2 after op1, no change
const t2 = transform(
  { type: 'insert', position: 1, character: 'A' },
  { type: 'insert', position: 3, character: 'B' }
)
console.assert(t2.position === 1, `insert vs insert (after): expected 1 got ${t2.position}`)

// delete vs delete — same position, should be null
const t3 = transform(
  { type: 'delete', position: 2 },
  { type: 'delete', position: 2 }
)
console.assert(t3 === null, "delete vs delete same pos: expected null")

// delete vs delete — op2 before op1, shift op1 left
const t4 = transform(
  { type: 'delete', position: 3 },
  { type: 'delete', position: 1 }
)
console.assert(t4.position === 2, `delete vs delete (before): expected 2 got ${t4.position}`)

// insert vs delete — delete before insert, shift insert left
const t5 = transform(
  { type: 'insert', position: 3, character: 'X' },
  { type: 'delete', position: 1 }
)
console.assert(t5.position === 2, `insert vs delete: expected 2 got ${t5.position}`)

console.log("All OT tests passed!")