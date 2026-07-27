# Security Architecture

CollabDocs implements a defense-in-depth approach to secure user data and prevent common web vulnerabilities.

## Privilege Confusion Prevention (JWT Typing)

The application issues two distinct types of JSON Web Tokens:
1. **Auth Tokens** (`type: 'auth'`): Granted upon login. These provide full access to the user's account and documents.
2. **Share Tokens** (`type: 'share'`): Granted when an owner generates a share link. These only provide access to a specific document.

All REST routes modifying data, and the core WebSocket `io.use` authentication middleware, strictly enforce `type === 'auth'`. This prevents a malicious user from extracting a Share Token from a URL and using it to authenticate a socket connection or access the owner's dashboard.

## Cross-Site Scripting (XSS) Prevention

Because CollabDocs allows rich-text editing, the resulting HTML must be sanitized before persistence to prevent XSS attacks when that HTML is rendered by a peer.

The server implements a strict allowlist HTML sanitizer (`utils/sanitize.js`) that runs on every `PUT /api/documents/:id` request.
- **Allowed Tags**: Only harmless structural and formatting tags (e.g., `p`, `strong`, `em`, `h1`).
- **Forbidden Content**: `<script>`, `<object>`, `<embed>`, and all unrecognised tags are completely stripped.
- **Attribute Scrubbing**: Inline event handlers (like `onclick`) and dangerous `javascript:` URIs in `href` attributes are forcibly removed.

## Secure OAuth Token Exchange

To prevent credential leakage in browser history or via the `Referer` header, the Google OAuth flow uses a backend-to-frontend one-time code exchange. The frontend reads the `?code=` URL parameter and POSTs it to the backend to receive the JWT in the response body.

## Rate Limiting

The application uses `express-rate-limit` to prevent brute-force and Denial-of-Service attacks.
- **Auth Routes**: Capped at 20 requests per 15 minutes.
- **Document Routes**: Capped at 100 requests per 15 minutes.
- **WebSocket Limits**: A basic in-memory token bucket limits the rate of socket events (like `collab-restore`) to prevent server CPU exhaustion.
