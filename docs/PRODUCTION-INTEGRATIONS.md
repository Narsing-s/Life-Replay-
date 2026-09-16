# Production integrations

Life Replay now contains provider adapters and operational diagnostics for the production services listed in the production gap register.

## Implemented in code

- Provider capability reporting: `GET /api/health/providers`.
- Production diagnostics: `npm run doctor`.
- Backup integrity verification: `npm run restore-check -- <backup-directory>`.
- Email verification token lifecycle and password-reset token lifecycle.
- Password reset invalidates all existing sessions.
- Optional OpenAI-compatible LLM endpoint: `POST /api/v1/ai/ask/llm`.
- Optional OpenAI-compatible embedding generation: `POST /api/v1/ai/embeddings`.
- User-scoped AI context: only the authenticated user's memories are sent to the provider.
- Provider configuration is environment-driven; secrets are never committed.

## External infrastructure still has to be provisioned

Code cannot create third-party accounts or obtain credentials. Set these variables in the deployment platform before enabling each service:

### PostgreSQL

`DATABASE_URL` points at the managed PostgreSQL instance. The current application still uses SQLite internally, so this branch adds the configuration/diagnostic contract but does not falsely switch the live database without a tested schema migration.

### Durable object storage

Configure an S3-compatible endpoint using `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. The existing filesystem media path remains the compatibility path until the media repository is migrated and verified against the selected bucket.

### Distributed rate limiting

Set `REDIS_URL`. The existing process-local limiter remains the safe fallback for single-instance deployments.

### Email

Set `RESEND_API_KEY` and `EMAIL_FROM`. Verification and password-reset delivery then use the configured provider.

### AI and embeddings

Set `OPENAI_API_KEY`, plus optional `OPENAI_BASE_URL`, `OPENAI_MODEL`, and `OPENAI_EMBEDDING_MODEL`.

### Media workers

Set `FFMPEG_PATH` for a worker image containing FFmpeg. Set `CLAMAV_URL` for a reachable malware-scanning service. These capabilities are detected but intentionally are not faked as active when the services are absent.

### Observability

Set `OTEL_EXPORTER_OTLP_ENDPOINT` when an OpenTelemetry collector is available. Until then the application continues using request IDs and structured server-side error logs.

## Multi-instance readiness

A deployment is considered infrastructure-ready only when managed PostgreSQL, durable object storage, and Redis are configured together. Local SQLite/filesystem storage must not be used as the shared state layer for multiple application instances.

## Production gate

Run:

```bash
npm run check
npm run doctor
npm run preflight
npm run backup
npm run restore-check -- <backup-directory>
```

The diagnostics deliberately fail production when the mandatory shared infrastructure variables are absent. This prevents a multi-instance production deployment from silently starting with local-only state.
