# Contributing to CollabDocs

First off, thank you for considering contributing to CollabDocs! It's people like you that make CollabDocs such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue tracker as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible according to the bug report template.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When you create an enhancement issue, please use the feature request template and provide a clear, detailed explanation of the feature you want.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes (`npm run test` in server).
5. Ensure your code lints (`npm run lint` in both client and server).
6. Issue that pull request!

## Local Development

Read `README.md` for local setup instructions. The basic flow is:

1. Copy `server/.env.example` to `server/.env` and fill it out.
2. Run `npm install` in both `client` and `server`.
3. Run `npx prisma db push` in `server`.
4. Run `npm run dev` in both directories to start the frontend and backend.
