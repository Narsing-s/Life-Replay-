# Life Replay — Production Status

Updated: 2026-09-16

## Current deployment

- Frontend: GitHub Pages
- Backend test deployment: SnapDeploy
- Runtime: Node/Express
- Current SnapDeploy compatibility storage: SQLite + container filesystem
- Current SnapDeploy URL: `https://life-replay-api-91493.containers.snapdeploy.app`

The current hosted backend is for application testing. It is not yet the final durable lifetime-memory deployment.

## Production-hardening capabilities in this branch

| Capability | Status |
|---|---|
| PostgreSQL schema + pgvector | ✅ Added |
| Ordered PostgreSQL migrations | ✅ Added |
| S3/R2/MinIO storage adapter | ✅ Added |
| Private/signed media capability | ✅ Added |
| Redis/BullMQ queues | ✅ Added |
| Media processing lifecycle | ✅ Added |
| Document/OCR worker | ✅ Added; OCR provider required |
| Google Photos OAuth/import pipeline | ✅ Added; provider credentials required |
| AI/embedding provider integration | ✅ Added; provider credentials required |
| Notification worker | ✅ Added |
| Realtime gateway | ✅ Added; client deployment still required |
| Backup/checksum/retention tooling | ✅ Added |
| Restore-drill tooling | ✅ Added |
| Orphan-media cleanup | ✅ Added; dry-run by default |
| Stale-job reconciliation | ✅ Added |
| Production doctor/preflight | ✅ Added |
| CI/security validation | ✅ Added |
| Native mobile client | 🟡 Not yet shipped |
| Native desktop client | 🟡 Not yet shipped |

## Durable production cutover

Before calling the service a durable lifetime-memory system:

1. Deploy the PostgreSQL production runtime.
2. Configure Redis.
3. Configure S3/R2/MinIO object storage.
4. Run ordered database migrations.
5. Move all media writes away from the local filesystem.
6. Enable authenticated private media access.
7. Deploy long-running workers.
8. Configure backups and off-site backup verification.
9. Run `npm run doctor`.
10. Perform a restore drill.
11. Test the browser against the deployed API.
12. Verify a second API instance can read the same user data.

## Hosting

The repository is prepared for Docker-based hosting and includes `render.yaml` plus deployment documentation. The repository connection itself does not have credentials to create a service in an external hosting account, so no new external service is claimed as deployed unless its URL is actually verified.

See `docs/DEPLOYMENT.md` for the current SnapDeploy deployment, Render/Docker deployment path and durable production architecture.

## Remaining work

- Complete PostgreSQL repository/service cutover for every feature route.
- Complete all frontend integrations with realtime/job status.
- Add native mobile and desktop clients.
- Complete provider-specific Calendar/Drive integrations.
- Add full collaboration/share-permission UI.
- Complete browser E2E and load/failure testing.
- Finish production monitoring/alerting and documented RPO/RTO operations.

## Release gate

Do not advertise the current SnapDeploy SQLite deployment as a durable backup of irreplaceable memories. The durable release gate requires PostgreSQL, Redis, object storage, successful backups/restores, worker processing, multi-instance validation and browser E2E verification.