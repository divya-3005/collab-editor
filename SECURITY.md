# Security Policy

## Supported Versions

Currently, only the latest version of CollabDocs is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Instead, please report them directly to the maintainers via email at security@example.com (placeholder). 

You should receive a response within 48 hours. If the issue is confirmed as a vulnerability, we will open a private draft security advisory to collaborate on a fix.

## Security Features in CollabDocs

CollabDocs is built with security as a priority:
- **JWT Type Verification**: Auth tokens and Share tokens are strictly segregated to prevent privilege confusion.
- **XSS Prevention**: All rich-text HTML is scrubbed through a strict allowlist sanitizer before entering the database.
- **OAuth Security**: Tokens are exchanged via secure one-time codes on the server-side, never leaked in browser history.
- **Rate Limiting**: Critical endpoints (Auth, Documents) and Socket connections are rate-limited to prevent abuse.
