# Remaining Production Gaps

Updated 2026-09-16.

## Implemented in the hardening branch

- Browser uploads can use the storage adapter instead of exposing the upload directory in production.
- Production media URLs are authenticated through `/api/v1/media/:id`; remote objects use short-lived signed URLs.
- Media uploads enqueue a durable BullMQ `media-processing` job when Redis is configured.
- The media worker can download a remote object before scanning/transcoding it, so remote object storage is compatible with asynchronous processing.
- Production provider health reports PostgreSQL/Redis connectivity rather than treating configuration alone as connectivity.
- PostgreSQL + pgvector baseline schema exists under `packages/database/migrations/001_initial.sql`.
- Production preflight continues to fail closed when the required shared services are missing.

## Still required before calling the application production-ready

### P0 — Runtime data plane

1. Replace the live core API repository's SQLite reads/writes with PostgreSQL.
2. Refactor the feature API (`feature-routes.js`) to the same PostgreSQL repository; it currently receives the SQLite connection directly.
3. Run and verify the SQLite-to-PostgreSQL migration against a real copy of production data.
4. Add transaction boundaries and migration versioning/rollback checks.

### P0 — Media lifecycle

1. Store media metadata in PostgreSQL as part of the same durable write path.
2. Add media processing state (`queued`, `scanning`, `ready`, `rejected`, `failed`) to the runtime repository.
3. Persist scan/transcode results and retry information.
4. Generate thumbnails/previews and retain originals separately.
5. Add orphan-object cleanup and deletion reconciliation.

### P1 — Search and AI

1. Write embeddings into the PostgreSQL `vector(1536)` column from the production repository.
2. Add authenticated vector similarity retrieval scoped by `user_id`.
3. Connect retrieval results to the configured LLM and persist AI job state.
4. Add provider timeouts, retry/backoff and usage limits.

### P1 — Reliability and disaster recovery

1. Back up PostgreSQL using managed snapshots or `pg_dump` to off-site storage.
2. Back up/version object storage independently of the application container.
3. Schedule backups outside the web process.
4. Run automated restore drills and verify checksums and record counts.
5. Define measurable RPO/RTO and alert on failed backups.

### P1 — Security/privacy

1. Move long-lived browser auth toward secure HttpOnly cookies or a short-lived access-token + refresh-token flow end-to-end.
2. Add CSRF protection if cookies are enabled.
3. Add session/device management UI and revoke-all support in the client.
4. Add content-signature validation and quarantine before accepting untrusted media.
5. Ensure share links expose only explicitly selected memories and enforce expiration/revocation consistently.
6. Add privacy/export/deletion verification and audit coverage.

### P2 — Integrations

- Google Photos import still requires real Google OAuth credentials and an import worker.
- Apple Photos requires its platform/provider-specific integration; it must not be represented as imported without a real provider path.
- Calendar, email and notification connectors need provider credentials, durable jobs and retry/dead-letter handling.

### P2 — Client coverage

- Web is the active client.
- Mobile and desktop architecture/scaffolding are not equivalent to completed native clients.
- Native clients need authenticated API integration, offline sync, conflict handling and secure local storage.

## Definition of done

A production capability is complete only when configuration, runtime consumption, health/readiness, integration tests, retries/failure handling, ownership isolation, deletion behavior and recovery behavior are all verified against the real provider.
