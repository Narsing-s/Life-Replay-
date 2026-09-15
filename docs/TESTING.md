# Testing Guide

## Local API tests

Install dependencies and run the automated API suite:

```bash
npm install
npm test
```

The suite starts an isolated local server with a temporary SQLite directory and covers:

- Health endpoint
- Anonymous access rejection
- Registration
- Login
- Authenticated current-user lookup
- Invalid credentials
- Secret/error response hygiene

## Static checks

```bash
npm run check
```

## Docker verification

```bash
docker build -t life-replay:local .
docker run --rm -p 4173:4173 \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  -v life-replay-data:/app/data \
  life-replay:local
```

Then verify `GET /api/health` returns a successful JSON response.

## CI checks

Pull requests and pushes to `main` run:

- Node.js tests
- Production dependency audit
- Docker image build
- CodeQL security analysis
- Dependency review on pull requests

## Manual release checklist

Before a production release:

- Verify registration and login from the deployed frontend.
- Verify authenticated memory listing.
- Verify image upload and deletion.
- Verify share-link creation and reading.
- Verify persistent storage survives a restart.
- Confirm HTTPS and CORS configuration.
- Confirm no secrets or user data are present in the repository.
