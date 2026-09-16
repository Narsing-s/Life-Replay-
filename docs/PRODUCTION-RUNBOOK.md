# Life Replay production runbook

## 1. Required production configuration

Set these in the deployment platform, never in Git:

- `NODE_ENV=production`
- `JWT_SECRET` — random, 32+ characters
- `DATA_DIR` — an absolute path backed by a persistent volume
- `ALLOWED_ORIGINS` — the exact HTTPS frontend origin(s)
- `MAX_UPLOAD_BYTES` / `MAX_MEDIA_BYTES` as appropriate for the plan

Run before deployment:

```bash
npm run check
npm run preflight
npm test
```

## 2. Persistence requirement

Life Replay currently stores SQLite, `uploads/`, and `media/` under `DATA_DIR`. A container filesystem is not a lifetime-memory store. The deployment must mount durable storage to `DATA_DIR` or memories/media can disappear when the container is replaced.

The application is intentionally provider-neutral. PostgreSQL and object storage remain infrastructure upgrades rather than pretending SQLite/local files are durable cloud storage.

## 3. Backup

Set `BACKUP_DIR` to a durable backup destination and run:

```bash
npm run backup
```

The backup contains:

- `life-replay.db`
- `uploads/`
- `media/`
- `manifest.json`

Backups must be copied off the application volume and periodically restored into an isolated environment. A backup that has never been restored is not a verified recovery plan.

## 4. Security checklist

- Use a unique production `JWT_SECRET`.
- Keep `ALLOWED_ORIGINS` explicit; do not use `*` for a private memory service.
- Put the API behind HTTPS.
- Rotate/revoke user sessions when account compromise is suspected.
- Keep the deployment platform's secret manager as the source of truth for API keys.
- Do not expose account numbers, tokens, passwords, or internal storage paths in UI/logs.

## 5. External integrations still require infrastructure

The codebase contains integration seams for AI and Google Photos, but these are not magically enabled by the repository alone. They require provider credentials, callback configuration, privacy controls, rate/cost limits, and production testing.

## 6. Remaining infrastructure upgrades

These are deliberately not falsely marked as complete:

- Managed PostgreSQL with migrations and tested restore.
- S3-compatible/object storage with private/signed media URLs.
- Distributed rate limiting.
- Rotating refresh-token authentication with replay detection.
- Email verification and password recovery.
- Malware/content scanning and media transcoding.
- Background queue with retries/idempotency.
- Centralized logs, metrics, tracing, and alerting.
- Multi-region/DR strategy and load testing.
- Real vector/embedding search and provider-isolated AI execution.
