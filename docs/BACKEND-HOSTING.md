# Life Replay Backend Hosting

## Verified test backend

The current test backend is deployed at:

`https://life-replay-api-91493.containers.snapdeploy.app`

Frontend:

`https://narsing-s.github.io/Life-Replay-/`

CORS must contain:

`https://narsing-s.github.io`

## Deploy to a new host

The application is Docker-based. Any host that supports Docker, HTTPS, environment variables and persistent storage can run the backend.

### Render

Use the repository `render.yaml` blueprint or create a Docker Web Service using the repository Dockerfile.

Set:

```text
NODE_ENV=production
ALLOWED_ORIGINS=https://narsing-s.github.io
DATA_DIR=/app/data
JWT_SECRET=<generated-by-host>
```

For the compatibility SQLite runtime, attach persistent storage to `/app/data`.

### Generic Docker host

```bash
docker build -t life-replay .

docker run -d --name life-replay \
  -p 4173:4173 \
  -e NODE_ENV=production \
  -e PORT=4173 \
  -e JWT_SECRET='<strong-secret>' \
  -e ALLOWED_ORIGINS='https://narsing-s.github.io' \
  -e DATA_DIR=/app/data \
  -v life-replay-data:/app/data \
  life-replay
```

Put the service behind HTTPS.

## Durable architecture

For real lifetime-memory storage, configure:

- PostgreSQL/pgvector
- Redis
- S3/R2/MinIO object storage
- API process
- media/document/AI/notification workers as required
- external scheduler for backups and reconciliation

The production branch includes preflight validation, ordered migrations, storage adapters, queues, workers, backup verification, restore-drill tooling and orphan cleanup.

## Environment

Use `.env.production.example` as the source of configuration names. Secrets must be entered into the hosting platform and never committed.

Required durable values include:

```text
JWT_SECRET
TOKEN_ENCRYPTION_KEY
FRONTEND_URL
ALLOWED_ORIGINS
DATABASE_URL
REDIS_URL
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
```

## Verification

After deployment:

```text
GET /api/health
GET /api/health/ready
```

Then run:

```bash
npm run doctor
```

Finally register a test user, add a memory, upload media, refresh, sign out/in, test protected media, export data and test the visible UI feature hubs.

## Important

This repository connection can modify the GitHub repository but does not contain credentials for your external hosting account. Therefore a new external hosting service cannot be honestly claimed as deployed from here. The existing SnapDeploy URL is the verified test backend; the deployment files are ready for you to connect to a hosting account.