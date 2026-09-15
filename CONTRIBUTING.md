# Contributing to Life Replay

Thank you for helping improve Life Replay.

## Before you start

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to follow it.

## Development setup

Requirements:

- Node.js 22+
- npm
- Git

Clone and install:

```bash
git clone https://github.com/Narsing-s/Life-Replay-.git
cd Life-Replay-
npm install
```

Run the backend/frontend locally:

```bash
JWT_SECRET="replace-with-a-long-random-secret" npm start
```

Then open `http://localhost:4173`.

## Making changes

1. Create a focused branch from `main`.
2. Make the smallest complete change that solves the problem.
3. Keep authentication, privacy, and user-owned memory data secure.
4. Test the affected user flow locally.
5. Update documentation when behavior or configuration changes.
6. Do not commit passwords, JWT secrets, API keys, personal photos, database files, or uploaded user data.
7. Open a pull request with a clear description of the problem and solution.

## Pull requests

A good pull request should include:

- What changed and why.
- How it was tested.
- Screenshots for meaningful UI changes.
- Any deployment or environment-variable changes.
- Any security or privacy considerations.

Keep unrelated refactors out of feature or bug-fix pull requests.

## Commit messages

Use short, descriptive commit messages such as:

- `feat: add memory search`
- `fix: handle expired session`
- `docs: update deployment guide`
- `security: tighten upload validation`

## Reporting bugs

Use the GitHub issue tracker. Include reproduction steps, expected behavior, actual behavior, browser/device information, and relevant logs. Never include secrets or private memory content.

## Feature requests

Explain the user problem first, then describe the proposed solution and alternatives considered.

## Security

Do not report security vulnerabilities in a public issue. Follow `SECURITY.md`.
