# Life Replay — Production Status

Updated: 2026-09-16

## Current deployment

- Frontend: GitHub Pages
- Backend: SnapDeploy
- Runtime: Node/Express compatibility application
- Current test deployment database: SQLite
- Current test deployment media: container filesystem

## Production platform added in this branch

| Area | Status |
|---|---|
| SQLite compatibility | ✅ Existing runtime retained |
| PostgreSQL | 🟡 Schema, pgvector schema and migration tool added; API cutover required |
| Object storage | 🟡 S3/R2/MinIO adapter and migration tool added; upload cutover required |
| Private media | 🟡 Signed-storage capability added; legacy public `/uploads` must be retired after cutover |
| Off-site backups | 🟡 Encrypted scheduled PostgreSQL backup workflow added; GitHub secrets required |
| Restore testing | 🟡 SQLite verifier and isolated PostgreSQL restore drill added |
| Distributed rate limiting | 🟡 Redis implementation added; production Redis required |
| Email verification | 🟡 Persistent verification state and token flow added; email provider required |
| Password reset | 🟡 Single-use reset flow + session revocation added; email provider required |
| Refresh token rotation | ✅ Rotation/revocation endpoint added |
| Google OAuth | 🟡 Encrypted OAuth foundation added; provider APIs/import workers still required |
| LLM | 🟡 Authenticated provider integration with timeout added; provider key/budget required |
| Embeddings | 🟡 Provider integration + pgvector schema added; retrieval cutover required |
| Video processing | 🟡 Durable worker + ffmpeg hook added; worker deployment required |
| Malware scanning | 🟡 ClamAV hook added; scanner deployment required |
| OCR | 🟡 Document worker hook added; OCR runtime/provider required |
| Notifications | 🟡 Durable notification worker added; provider configuration required |
| WebSocket | 🟡 Authenticated Redis-backed realtime gateway added; separate deployment/client wiring required |
| Observability | 🟡 Structured logs + Prometheus metrics added; monitoring exporter/alerts required |
| CI | ✅ Syntax, tests, audit, Docker and compose validation added |
| Multi-instance | 🟡 Shared DB/storage/Redis/queue foundations added; complete repository/upload cutover required |

## Important durability statement

The current SnapDeploy instance still uses SQLite and local filesystem media. It is **not yet a durable lifetime-memory deployment**. The new PostgreSQL/object-storage infrastructure must be configured and the existing synchronous SQLite route layer must be migrated before multiple API replicas are enabled.

## Remaining product work

- Complete asynchronous PostgreSQL repository/service cutover.
- Route all uploads through S3/R2/MinIO and remove public filesystem media.
- Add authenticated signed-media access and cleanup/orphan reconciliation.
- Add image thumbnails, EXIF consent handling, optimization and quarantine state.
- Complete Google Photos import, Calendar/Drive sync and provider-specific retry jobs.
- Add compliant regional finance provider only after provider selection and consent requirements are defined.
- Add hybrid PostgreSQL full-text + pgvector retrieval.
- Add AI summaries, captions, replay reports and explicit per-user cost/rate budgets.
- Add collaboration permissions UI, comments/reactions, protected/expiring shares and QR cards.
- Add browser/mobile E2E coverage and load/failure testing.
- Add secret/dependency/container scanning and a documented RPO/RTO disaster-recovery runbook.

## Production release gate

Do not advertise the service as a durable lifetime-memory service until `npm run doctor` passes against real PostgreSQL/Redis, media survives an API restart from object storage, a second API instance can access the same user data, an encrypted off-site backup is restored successfully, and the browser E2E suite passes.
