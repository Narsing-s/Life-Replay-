# Production lifecycle controls

The production runtime now treats asynchronous work as durable state rather than a successful enqueue being equivalent to completion.

## Durable job lifecycle

`packages/database/migrations/002_production_lifecycle.sql` adds:

- `job_runs` for queued/running/completed/failed state and bounded result/error metadata.
- `import_jobs` and `import_items` for provider import progress and provider-level deduplication.
- `notification_deliveries` for idempotent delivery tracking.
- `backup_runs` for local/off-site backup evidence.
- media processing fields for scan, processing, rejection and failure state.

`queue-adapter.js` persists a job before dispatching it to BullMQ and records a dispatch failure when Redis rejects the job.

## Media

The media worker now:

1. downloads from object storage when a local source is unavailable;
2. validates common file signatures instead of trusting MIME type alone;
3. records scanning/processing/ready/rejected/failed state;
4. records ClamAV rejection/failure state when configured;
5. transcodes video when FFmpeg is configured;
6. records processed object keys;
7. records durable job completion/failure state.

## AI, documents and notifications

All three workers now write durable `job_runs` lifecycle state and close their PostgreSQL/Redis resources on shutdown. Document processing can consume object-storage keys instead of requiring a persistent local filesystem.

## Backups

`npm run backup:postgres` still creates a checksummed PostgreSQL custom-format dump and now optionally uploads the dump to configured S3-compatible object storage when `BACKUP_OFFSITE=true` and the backup S3 credentials are present. The result is recorded in `backup_runs`.

The backup is deliberately reported as `local-only` when off-site backup is not configured; the application never claims an off-site copy exists in that state.

## Cleanup

`npm run cleanup:media` removes database orphan media records and their referenced storage objects after the configured grace period (`ORPHAN_MEDIA_AGE_HOURS`, default 24 hours). The operation is bounded to 500 records per run so it can safely be scheduled repeatedly.

## What still requires real infrastructure

Code cannot manufacture external provider credentials. Google Photos, Apple Photos, email delivery, LLM/embedding providers, ClamAV, FFmpeg, Redis, PostgreSQL and object storage become operational only when their credentials/services are actually configured and reachable. The readiness endpoints intentionally expose the real configured/reachable state.
