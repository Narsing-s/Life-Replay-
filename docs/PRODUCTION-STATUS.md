# Life Replay — Production Status

Updated: 2026-09-16

## Current deployment

- Frontend: GitHub Pages
- Verified test backend: SnapDeploy
- Runtime: Node/Express
- Current SnapDeploy compatibility storage: SQLite + container filesystem
- Current SnapDeploy URL: `https://life-replay-api-91493.containers.snapdeploy.app`

The current hosted backend is for application testing. It is not the final durable lifetime-memory deployment.

## Product/UI status

The web workspace exposes these product areas:

- Add Memory
- Timeline
- Replay
- Photos & Imports
- Documents & OCR
- Search & AI
- Map
- Calendar
- People
- Tags
- Favorites
- Trash
- Background Jobs
- Account
- Settings
- Integrations
- Notifications
- Security

Provider-dependent capabilities remain visible but must show their real configuration state. The UI must not fabricate successful imports, OCR, or AI operations.

## Production-hardening capabilities

| Capability | Status |
|---|---|
| PostgreSQL schema + pgvector | Implemented |
| Ordered PostgreSQL migrations | Implemented |
| S3/R2/MinIO storage adapter | Implemented |
| Private/signed media capability | Implemented |
| Redis/BullMQ queues | Implemented |
| Media processing lifecycle | Implemented; provider/worker dependencies required |
| Malware scanning | Implemented; ClamAV required |
| Video transcoding | Implemented; FFmpeg required |
| Document/OCR worker | Implemented; OCR provider required |
| Google Photos OAuth/import pipeline | Implemented; Google credentials required |
| Google resumable import/deduplication | Implemented |
| AI/embedding provider integration | Implemented; provider credentials required |
| Replay generation jobs | Implemented; AI provider required for generated output |
| Notification worker | Implemented; provider configuration as required |
| Realtime gateway | Implemented; frontend/mobile client adoption remains incremental |
| Backup/checksum/retention tooling | Implemented |
| Backup verification | Implemented |
| Restore-drill tooling | Implemented |
| Orphan-media cleanup | Implemented; dry-run by default |
| Stale-job reconciliation | Implemented |
| Production doctor/preflight | Implemented |
| CI/security validation | Implemented |
| Browser E2E release gate | Still required |
| Native mobile client | Not shipped in current web deployment |
| Native desktop client | Not shipped in current web deployment |
| Apple Photos server import | Not enabled |
| External calendar synchronization | Not enabled |

## Durable production cutover

Before calling the service a durable lifetime-memory system:

1. Deploy the PostgreSQL production runtime.
2. Configure Redis/BullMQ.
3. Configure S3/R2-compatible object storage.
4. Run ordered database migrations.
5. Move all authoritative media writes away from the local container filesystem.
6. Enable authenticated/private media access.
7. Deploy long-running workers separately from the API.
8. Configure backups, verification and off-site copies.
9. Run `npm run doctor` against the real deployment.
10. Perform an isolated restore drill.
11. Test the browser against the deployed API.
12. Verify a second API instance can read the same user data.
13. Run browser E2E tests.

## Hosting

The repository is Docker-ready and includes `render.yaml` plus deployment documentation. The repository connection does not have credentials to create a service inside an external hosting account, so no new external service is claimed as deployed unless its URL is actually verified.

See `docs/DEPLOYMENT.md` and `docs/BACKEND-HOSTING.md` for the deployment procedure.

## Provider honesty

A capability may be visible in the UI while still being provider-disabled. Status must distinguish `available`, `configured`, `queued`, `running`, `completed`, `failed` and `not configured` where applicable.

## Release gate

Do not advertise the current SnapDeploy SQLite deployment as a durable backup of irreplaceable memories. The durable release gate requires PostgreSQL, Redis, object storage, successful backup/restore verification, worker processing, private media, multi-instance validation and browser E2E verification.