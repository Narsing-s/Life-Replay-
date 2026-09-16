# Production schedules

Life Replay intentionally keeps scheduling outside the API process. Run these jobs from the hosting provider's cron/scheduler, Kubernetes CronJob, system cron, or an equivalent durable scheduler.

## Recommended jobs

### PostgreSQL backup

Run daily during the lowest-traffic period:

```bash
npm run backup:postgres
```

### Backup retention

Run after the backup job:

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

### Restore drill

Run at least monthly against a disposable PostgreSQL instance. Never restore a production backup directly over the live database.

```bash
npm run restore:drill
```

### Queue workers

Run workers as long-lived processes, separately from the HTTP API:

```bash
npm run worker:media
npm run worker:document
npm run worker:ai
npm run worker:notifications
npm run realtime
```

Workers must share the same `REDIS_URL`, PostgreSQL credentials and object-storage configuration as the API.

## Provider rule

A scheduler must never mark an import, backup, AI task, notification or media operation as completed merely because a job was queued. Completion is recorded only after the worker receives a successful provider response and persists the resulting state.
