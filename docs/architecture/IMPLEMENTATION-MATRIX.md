# LifeOS implementation matrix

| Area | Implementation in branch | External setup / cutover still required |
|---|---|---|
| SQLite | Existing compatibility runtime | Keep only as migration/dev path for multi-instance |
| PostgreSQL | Production schema + migration utility + pgvector schema | Switch API repositories/routes from synchronous SQLite to PostgreSQL |
| Durable object storage | S3/R2/MinIO adapter + media migration utility | Configure bucket/credentials and switch upload handlers |
| Private media | Storage adapter supports signed reads | Existing legacy `/uploads` route must be retired after upload cutover |
| Off-site backups | Scheduled encrypted pg_dump -> S3-compatible storage | Add GitHub secrets and verify destination lifecycle |
| Restore testing | SQLite verifier + PostgreSQL restore drill | Run drill against isolated restore database on schedule |
| Distributed rate limiting | Redis atomic counter with local fallback | Configure Redis and require it in production |
| Email verification | Token flow + persistent `email_verified_at` | Configure Resend and sender domain |
| Password reset | Single-use token + session revocation + frontend URL | Configure Resend and frontend reset UI |
| Refresh tokens | Hashed tokens + rotation/revocation | Migrate clients to refresh endpoint and short access TTL |
| Google OAuth | Encrypted token storage + OAuth state + integration management | Configure Google client/consent/API and implement import/sync jobs |
| Calendar/Drive | Google OAuth scopes are supported by integration foundation | Provider-specific sync workers |
| AI | Authenticated LLM endpoint + prompt isolation + timeout | Configure provider, cost budget and policy |
| Embeddings | Provider endpoint + SQLite JSON storage + PostgreSQL pgvector schema | Move retrieval to pgvector and run indexing jobs |
| Search | SQL filtering today | Add hybrid full-text/vector retrieval service at PG cutover |
| Video | BullMQ media worker + ffmpeg hook | Deploy worker and configure queue/storage |
| Malware | ClamAV hook before processing | Deploy scanner and quarantine flow |
| OCR | Document worker with configurable OCR command | Deploy Tesseract/Document AI provider and persist extracted text |
| Notifications | Durable BullMQ email worker | Configure email provider and notification policies |
| WebSocket | Authenticated Redis-backed realtime gateway | Deploy gateway behind TLS and connect clients |
| Observability | Structured logs + request IDs + Prometheus metrics | Export metrics/logs to monitoring provider and configure alerts |
| Multi-instance | Redis, queues, shared storage and PG foundations | Complete PG/storage upload cutover, then scale API replicas |
| CI | Syntax, tests, audit, Docker, compose validation | Add E2E/browser tests and security scanning gates |
| Integrations | Google OAuth storage foundation | Add user-facing connection/import controls and provider-specific workers |
| Finance | No fake connector | Select a compliant regional provider and implement least-privilege integration |
| Apple Photos | Not faked | Native mobile access required where platform permits |

## Release gate

Do not label the service production-ready until:

- `npm run doctor` succeeds against real PostgreSQL and Redis.
- A real media upload is stored outside the application filesystem and can be retrieved after an API restart.
- A second API instance can read the same account and memory data.
- An encrypted backup exists off-site and a restore drill succeeds.
- A refresh-token replay is rejected.
- Email verification and password reset have been delivered and confirmed.
- Queue workers can be restarted without losing jobs.
- Media scanning/transcoding failures leave the asset quarantined/retryable.
- Metrics and alerts are visible from the deployment environment.
- Browser E2E covers registration, login, upload, logout/login, search, delete/restore, export and account deletion.
