# Life Replay Deployment Guide

## Current test deployment

- Frontend: GitHub Pages
- Backend: SnapDeploy
- Backend: `https://life-replay-api-91493.containers.snapdeploy.app`
- Frontend: `https://narsing-s.github.io/Life-Replay-/`
- Health: `GET /api/health`
- Readiness: `GET /api/health/ready`

Use `https://narsing-s.github.io` as the CORS origin. Do not include `/Life-Replay-` in the CORS origin.

## Deploy the backend

The backend is a Dockerized Node/Express service and can run on any Docker-capable host.

### Render

The repository includes `render.yaml`.

1. Create a Web Service/Blueprint from `Narsing-s/Life-Replay-`.
2. Use the repository Dockerfile.
3. Use `/api/health` as the health check.
4. Set `ALLOWED_ORIGINS=https://narsing-s.github.io`.
5. Generate a strong `JWT_SECRET` in the hosting platform.
6. For the SQLite compatibility runtime, persist `/app/data`.
7. Deploy and copy the generated HTTPS backend URL.

This is suitable for testing. It is not the final durable lifetime-memory architecture.

### Docker host

```bash
docker build -t life-replay .
docker run -d --name life-replay \
  -p 4173:4173 \
  -e NODE_ENV=production \
  -e PORT=4173 \
  -e JWT_SECRET="<strong-secret>" \
  -e ALLOWED_ORIGINS="https://narsing-s.github.io" \
  -e DATA_DIR=/app/data \
  -v life-replay-data:/app/data \
  life-replay
```

Put HTTPS in front of the container using the hosting provider's reverse proxy/load balancer.

## Durable production architecture

```text
Web / Mobile
     |
     v
 HTTPS API
     |
 Node / Express
  /    |     \
 /     |      \
PG    Redis   S3/R2
 |      |       |
 +------+-------+
        |
 Background workers
```

Required durable services:

- PostgreSQL/pgvector
- Redis/BullMQ
- S3-compatible object storage
- API process
- Media worker
- Document/OCR worker when enabled
- AI worker when enabled
- Notification worker
- Google import worker when enabled
- Realtime gateway when enabled

Production preflight intentionally refuses to start when required database, Redis, object-storage or encryption settings are missing.

## Required durable environment

Configure from `.env.production.example` in the hosting platform; never commit real secrets:

- `NODE_ENV=production`
- `JWT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Optional providers: email, AI/embeddings, Google Photos OAuth, OCR, ClamAV and FFmpeg.

## Deployment smoke test

1. `GET /api/health` returns 200.
2. `GET /api/health/ready` reports required dependencies.
3. Register a test account.
4. Sign in.
5. Open Account and confirm the current user is shown.
6. Add a memory and verify it remains after refresh.
7. Test Timeline, Favorites, Trash and Map.
8. Test export.
9. Verify protected media requires authentication.
10. Run `npm run doctor` against the durable deployment.

## Workers and schedules

Run workers separately from the API and schedule backups/reconciliation outside the HTTP process. See `docs/operations/PRODUCTION-SCHEDULES.md`.

## Hosting-account limitation

The repository connection does not have credentials or authorization to create a service inside your external hosting account, so I cannot truthfully claim that I deployed a new backend there. The repository is prepared for deployment and the existing SnapDeploy test backend remains documented above.