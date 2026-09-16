# LifeOS production architecture

Life Replay is being hardened toward the LifeOS architecture without breaking the existing web client.

```text
Web / Mobile / Desktop
        |
        v
API / BFF (REST + future WebSocket)
        |
  +-----+---------+----------------+
  |               |                |
Identity      Life/Memory      AI Orchestrator
  |               |                |
  +-------+-------+----------------+
          |
   Documents/OCR  Search  Memory Engine
          |
          v
 PostgreSQL + pgvector + Object Storage + Redis/BullMQ
          |
 Calendar | Email | Cloud Drive | Finance | Notifications
```

## Repository target

The target workspace is intentionally compatible with the current Node/Express application while the services are extracted incrementally:

```text
apps/web
apps/mobile
apps/api
packages/database
packages/shared
packages/validation
packages/api-client
packages/ui
workers/document-worker
workers/ai-worker
workers/notification-worker
infrastructure/docker
infrastructure/nginx
infrastructure/terraform
infrastructure/monitoring
docs/architecture
docs/api
docs/security
docs/database
docs/product
scripts
tests/integration
tests/e2e
tests/fixtures
```

## Production invariants

1. PostgreSQL is the system of record for multi-instance deployment.
2. User media is private by default and stored in durable object storage.
3. Redis is used for distributed rate limiting and job coordination.
4. Background work is idempotent and retryable through BullMQ.
5. Access tokens are short-lived; refresh tokens are hashed, rotated and revocable.
6. AI receives only the authenticated user's explicitly selected memory context.
7. Uploaded media is quarantined/scanned before becoming available.
8. Backups are encrypted, stored off-site and restore-tested.
9. Request IDs and metrics are emitted for every API request.
10. Provider configuration is never treated as proof of connectivity; production doctor checks real PostgreSQL/Redis reachability.

## Implemented in this hardening branch

- PostgreSQL/pgvector schema and SQLite migration tool.
- S3-compatible storage adapter for AWS S3, Cloudflare R2 and MinIO.
- Redis-backed distributed rate limiting with safe local fallback.
- BullMQ queues and dedicated media, AI and notification workers.
- Media scanning/transcoding worker hooks.
- Structured logging and Prometheus metrics.
- Encrypted scheduled off-site PostgreSQL backup workflow.
- Isolated PostgreSQL restore drill and SQLite backup verification.
- Persistent email verification state and password-reset links based on `FRONTEND_URL`.
- Refresh-token rotation with replay prevention by revoking the consumed session token.
- CI syntax/test/audit/container/infrastructure validation.

## Deliberate cutover requirement

The existing `server.js` and `feature-routes.js` still use the synchronous SQLite API for compatibility. The PostgreSQL schema and migration path are therefore **not** a claim that the running legacy API has already switched databases. The production cutover must migrate the route/repository layer to the asynchronous PostgreSQL repository before enabling multiple API replicas.

Likewise, the object-storage adapter is production-ready but existing legacy upload handlers must be switched to write through it before local filesystem media is considered disposable.

## Remaining product integrations

- Google Photos/Calendar/Drive require OAuth credentials, consent, token encryption and provider-specific import/sync jobs.
- Apple Photos requires native/platform-specific access; it cannot be honestly implemented as a generic server-side web import.
- Finance integrations require a provider selected by region/account type; no fake banking connector is included.
- OCR requires a document worker and an OCR provider/runtime.
- WebSocket realtime requires a shared pub/sub layer and connection authentication.
- Mobile and desktop shells can consume the same API client once the API repository is extracted.
