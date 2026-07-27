/**
 * loadEnv.js — Environment loader + startup validation.
 *
 * Loads .env variables and validates all required configuration before the
 * server starts accepting connections. If any required variable is missing or
 * too short, the process exits with a descriptive error message.
 *
 * Preventing the server from starting in a misconfigured state is always
 * better than discovering the misconfiguration from a production error.
 * Specifically:
 *  - JWT_SECRET missing → jwt.sign(payload, undefined) produces tokens that
 *    are effectively unverifiable/unsecured.
 *  - DATABASE_URL missing → Prisma connects to the wrong database or crashes
 *    on first query rather than at startup.
 */

import dotenv from 'dotenv';
dotenv.config();

const REQUIRED = [
  { key: 'JWT_SECRET',    minLength: 32, message: 'Must be at least 32 characters. Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"' },
  { key: 'DATABASE_URL',  minLength: 10, message: 'Must be a valid PostgreSQL connection string.' },
  { key: 'CLIENT_URL',    minLength: 1,  message: 'Must be the URL of the frontend app (e.g. http://localhost:5173).' },
];

const errors = [];

for (const { key, minLength, message } of REQUIRED) {
  const value = process.env[key];
  if (!value || value.trim().length < minLength) {
    errors.push(`  ✗ ${key}: ${message}`);
  }
}

if (errors.length > 0) {
  console.error('\n[startup] Environment validation failed — server will not start:\n');
  errors.forEach(e => console.error(e));
  console.error('\nFix the above variables in your .env file and restart.\n');
  process.exit(1);
}
