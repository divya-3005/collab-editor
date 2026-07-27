# Deployment Guide

This guide covers deploying the Node.js backend and React frontend.

## Prerequisites
- PostgreSQL database
- Google Cloud Console OAuth Credentials
- Node.js environment (v18+)

## Environment Configuration

Before deploying, ensure all required environment variables are set. The backend uses a startup validation script (`loadEnv.js`) that will intentionally crash the server if `JWT_SECRET` is too short or if `DATABASE_URL` is malformed. This prevents the server from booting in an insecure state.

## Horizontal Scaling Limitations

**IMPORTANT**: The current architecture is designed for a single-node deployment (e.g., a single Render Web Service or single EC2 instance).

Because the ProseMirror `collab` sequence state is held **in-memory** on the server, deploying multiple backend nodes behind a load balancer will result in partitioned state. If User A connects to Node 1, and User B connects to Node 2, they will not see each other's changes, and their version counters will diverge.

**To scale horizontally in the future:**
1. You must implement a Pub/Sub adapter (like Redis) for Socket.io.
2. The in-memory step buffer (`ot/collab.js`) must be moved to a fast centralized cache like Redis, or persisted to the database.

## Deployment on Render (Recommended)

1. Connect your GitHub repository to Render.
2. Create a **Web Service** for the backend:
   - Build Command: `npm install && npx prisma db push` (For early stages, `db push` is fine. Use `prisma migrate deploy` for production).
   - Start Command: `npm run start`
   - Set all Environment Variables.
3. Create a **Static Site** for the frontend:
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Set `VITE_API_URL` to the URL of your backend Web Service.
