# Life Replay — Production Implementation Matrix

This document tracks which production capabilities are implemented in code and which require deployment infrastructure.

## Application capabilities now implemented

- Production preflight validation
- Request IDs and security headers
- API/auth rate limiting
- Provider diagnostics
- Email verification token lifecycle
- Password-reset token lifecycle and session invalidation
- Optional OpenAI-compatible LLM integration
- Optional embedding generation
- Backup/restore verification tooling
- Production doctor command
- Account deletion
- User-scoped AI context

## Infrastructure capabilities

### PostgreSQL

The application currently boots its legacy SQLite schema directly through `better-sqlite3`. `DATABASE_URL` is detected and reported, but changing the application to PostgreSQL requires migrating the database access layer and migrations together. Do not mark PostgreSQL live until the application has been deployed against PostgreSQL and the full API test matrix passes.

Required production configuration:

- `DATABASE_URL`
- TLS-enabled PostgreSQL
- automated backups / point-in-time recovery
- migration runner
- connection pooling

### Durable object storage

The application detects S3-compatible storage, but legacy uploads and feature media currently use the local filesystem. Production migration requires an object-storage adapter, upload/multipart handling, private objects, signed URLs, lifecycle rules and a one-time media migration.

Required configuration:

- `S3_ENDPOINT` or `R2_ENDPOINT`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

### Off-site backups

Backup generation and restore verification exist locally. Production still needs a second failure domain for backup copies. Recommended policy: daily encrypted backup, retention policy, integrity manifest, and periodic restore drill.

### Automated backup schedule

Use the deployment provider's cron/scheduler to execute the backup command. The scheduler must run outside the application process so a crashed/restarted web instance cannot stop backups.

### Distributed rate limiting

Set `REDIS_URL` and move limiter counters to Redis for multi-instance deployments. The current process-local limiter remains useful as a secondary per-instance guard.

### Email

Set `RESEND_API_KEY` and `EMAIL_FROM`, then verify the sending domain. Email verification and password reset endpoints already use single-use, expiring server-side tokens.

### Google Photos

The repository has OAuth configuration foundations. A complete import must still implement OAuth authorization/callback, token encryption/rotation, incremental import state, duplicate detection, pagination, quota handling and provider-specific media retrieval.

### AI / embeddings

Set `OPENAI_API_KEY`. Configure `OPENAI_MODEL` and `OPENAI_EMBEDDING_MODEL`. Embeddings are currently persisted in the existing `embeddings` table. A production semantic-search implementation should add vector indexing/search rather than scanning JSON vectors.

### Video processing

Set `FFMPEG_PATH` in worker-capable infrastructure. Production processing should run asynchronously, create thumbnails/posters, generate streaming-friendly derivatives, preserve the original, and retry failed jobs.

### Malware scanning

Set `CLAMAV_URL` when a scanner service is deployed. Upload processing should quarantine untrusted files until scanning succeeds; never expose quarantined files publicly.

### Observability

Set `OTEL_EXPORTER_OTLP_ENDPOINT` for OpenTelemetry export. Production should also configure alerting for elevated 5xx rates, latency, storage failures, queue failures, authentication abuse and backup failures.

### Multi-instance deployment

A multi-instance deployment requires all mutable shared state to leave the process filesystem/memory:

1. PostgreSQL for relational state.
2. S3/R2 for media.
3. Redis for distributed rate limits, locks and ephemeral job state.
4. Durable queue/worker infrastructure for media and AI jobs.
5. Centralized logs/traces/metrics.
6. Stateless application containers.

The `providerStatus()` diagnostic reports `multiInstance.ready` only when PostgreSQL, object storage and Redis are configured. This is a configuration readiness signal, not proof that a production environment has been successfully tested.

## Additional production gaps to address before declaring full production readiness

- Replace public filesystem media URLs with authenticated/signed media delivery.
- Complete PostgreSQL repository/migration layer.
- Complete S3/R2 adapter and existing-media migration.
- Encrypt sensitive provider tokens at rest.
- Add refresh-token rotation and replay detection.
- Add CSRF protection if cookie authentication is enabled.
- Add session/device management UI.
- Add email-verification state to the user model and enforce it where required.
- Add share-link expiration/revocation enforcement to every share path.
- Add durable job queue with idempotency and retry/dead-letter handling.
- Add image thumbnails and responsive media derivatives.
- Add content-type/content-signature validation, not only MIME-header validation.
- Add upload quarantine before malware scan.
- Add storage checksum reconciliation and orphan cleanup.
- Add data-retention/export/delete verification.
- Add database migrations and rollback strategy.
- Add load, concurrency and failure-injection tests.
- Add browser/mobile end-to-end CI.
- Add dependency and container vulnerability scanning.
- Add secret scanning and signed release/build provenance.
- Add privacy/data-processing documentation and provider data-retention configuration.
- Add disaster-recovery runbook with measured RPO/RTO.

## Status rule

A capability is **Connected** only after its external service is configured in the deployment environment and the corresponding production smoke test has passed. Environment-variable detection alone is not sufficient.
