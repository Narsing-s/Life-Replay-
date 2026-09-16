# Production schedules

Life Replay intentionally keeps scheduling outside the API process. Run these jobs from the hosting provider's cron/scheduler, Kubernetes CronJob, system cron, or an equivalent durable scheduler.

## Recommended jobs

### PostgreSQL backup

Run daily during the lowest-traffic period:

```bash
npm run backup:postgres
```

When off-site protection is required, set `BACKUP_OFFSITE=true` and provide the S3-compatible backup credentials. The backup command reports `offsite` only after the upload succeeds.

### Backup verification

After every backup, verify the custom-format archive and checksum before retention removes older copies:

```bash
npm run backup:verify -- ./data/backups-postgres/<backup>.dump
```

The verifier checks archive readability, required core tables and the SHA-256 sidecar when present.

### Backup retention

Run after verification:

```bash
npm run backup:retention
```

Set `BACKUP_RETENTION_COUNT` to the number of verified backups to retain.

### Production doctor

Run every 15–30 minutes:

```bash
npm run doctor
```

Treat a non-zero exit code as an alert. The doctor checks PostgreSQL, Redis, object storage and configured providers.

### Stale-job reconciliation

Run every 10–15 minutes:

```bash
npm run jobs:reconcile
```

This marks jobs whose worker heartbeat has exceeded `STALE_JOB_MINUTES` (default 60) as failed and records the failure. It prevents permanently stuck `running` records from appearing healthy forever.

### Restore drill

Run at least monthly against a disposable PostgreSQL instance. Never restore a production backup directly over the live database.

```bash
npm run restore:drill
```

### Orphan media cleanup

Run daily after normal media processing has had time to settle:

```bash
npm run cleanup:media
```

Cleanup is **dry-run by default**. Set `ORPHAN_MEDIA_DRY_RUN=false` only after reviewing the reported orphan objects. `ORPHAN_MEDIA_AGE_HOURS` controls the grace period and `ORPHAN_MEDIA_MAX_OBJECTS` bounds each run. The job removes stale unowned media rows and remote objects that have no database reference; it never removes referenced media.

### Queue workers

Run workers as long-lived processes, separately from the HTTP API:

```bash
npm run worker:media
npm run worker:document
npm run worker:ai
npm run worker:notifications
npm run worker:google-import
npm run realtime
```

Workers must share the same `REDIS_URL`, PostgreSQL credentials and object-storage configuration as the API.

## Provider rule

A scheduler must never mark an import, backup, AI task, notification or media operation as completed merely because a job was queued. Completion is recorded only after the worker receives a successful provider response and persists the resulting state.
