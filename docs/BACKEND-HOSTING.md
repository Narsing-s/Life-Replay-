# Life Replay Backend Hosting

## Current test deployment

The verified browser-test backend is:

`https://life-replay-api-91493.containers.snapdeploy.app`

Frontend:

`https://narsing-s.github.io/Life-Replay-/`

CORS must contain exactly:

`https://narsing-s.github.io`

The current test deployment must not be treated as the authoritative storage location for irreplaceable memories.

## Deploy the backend

Life Replay is Docker-based. It can run on a Docker-capable cloud host or your own server.

### Render

The repository contains `render.yaml`.

1. Connect `Narsing-s/Life-Replay-` to the hosting account.
2. Deploy the Blueprint.
3. Confirm the service uses the repository Dockerfile.
4. Use `/api/health` as the health check.
5. Set `ALLOWED_ORIGINS=https://narsing-s.github.io`.
6. Generate a strong `JWT_SECRET` in the hosting platform.
7. For the SQLite compatibility runtime, persist `/app/data`.
8. Copy the generated HTTPS service URL and set the frontend backend configuration if it changes.

This mode is useful for application testing. It is not the final durable lifetime-memory architecture.

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

## Durable production architecture

For real lifetime-memory storage, deploy:

```text
Web / Mobile / Desktop
          |
       HTTPS API
          |
     Node / Express
     /      |      \
    /       |       \
PostgreSQL  Redis   S3 / R2
    |        |        |
    +--------+--------+
             |
       Background workers
```

Required durable services:

- PostgreSQL + pgvector
- Redis/BullMQ
- S3-compatible object storage such as S3/R2/MinIO
- API service
- media worker
- document/OCR worker when enabled
- AI worker when enabled
- notification worker
- Google import worker when enabled
- realtime gateway when enabled

Production preflight intentionally refuses to start if required PostgreSQL, Redis, object-storage or encryption configuration is missing.

## Durable environment

Use `.env.production.example` for the complete configuration list. Never commit real secrets.

Minimum durable configuration:

```text
NODE_ENV=production
JWT_SECRET=<random-secret>
TOKEN_ENCRYPTION_KEY=<random-secret>
FRONTEND_URL=https://narsing-s.github.io/Life-Replay-
ALLOWED_ORIGINS=https://narsing-s.github.io
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_ENDPOINT=https://...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Optional provider configuration covers email, LLM/embeddings, Google Photos OAuth, OCR, ClamAV and FFmpeg.

## Workers

Do not run long-lived workers inside the web request process. Deploy the workers separately or use the same image with different worker commands/process definitions:

- media processing
- document/OCR processing
- AI jobs
- notification delivery
- Google Photos imports
- realtime gateway where enabled

The API should enqueue durable work and return. Worker completion must be based on actual processing, not merely successful queue submission.

## Local production stack

`infrastructure/docker/docker-compose.production.yml` provides PostgreSQL/pgvector, Redis, MinIO and ClamAV foundations for integration testing.

## Verification

After deployment:

```text
GET /api/health
GET /api/health/ready
```

Then:

```bash
npm run doctor
```

Perform an end-to-end smoke test:

1. Register a test account.
2. Sign in.
3. Confirm Account shows the current user.
4. Add a memory.
5. Upload media.
6. Refresh and confirm the memory remains.
7. Test Timeline, Favorites, Trash and Map.
8. Test document/OCR only when OCR is configured.
9. Test Google import only after real Google OAuth is configured.
10. Verify protected media access.
11. Export data.
12. Restart the API and repeat the media read test.
13. For durable production, repeat against a second API instance.

## Backups and recovery

Run PostgreSQL backups outside the API process. Keep checksummed backups, verify archive readability, retain multiple generations and perform isolated restore drills. Keep off-site copies separate from the primary database host.

See `docs/operations/PRODUCTION-SCHEDULES.md`, `scripts/verify-postgres-backup.js` and `scripts/restore-drill.js`.

## Hosting-account limitation

The repository connection can modify the source repository but does not contain credentials or authorization to create a service inside an external hosting account. Therefore the existing SnapDeploy deployment is the verified backend; a new external service cannot be truthfully reported as deployed until the hosting account's deployment integration is authorized.