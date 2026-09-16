# Life Replay

**Remember the way it felt.**

Life Replay is a private personal-memory workspace for photos, videos, audio, documents and life events. It provides a searchable timeline, replay generation, people/places/tags, imports, document processing, AI assistance, sharing, notifications and account/security controls.

## Product workspace

The web UI exposes the complete product surface instead of hiding unfinished areas:

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

Provider-dependent capabilities are shown in the UI with their real configuration state. Life Replay does not claim that Google Photos, Apple Photos, OCR, AI or other provider features completed an operation when the required provider configuration is missing.

## Current web deployment

- Frontend: GitHub Pages — `https://narsing-s.github.io/Life-Replay-/`
- Test backend: SnapDeploy — `https://life-replay-api-91493.containers.snapdeploy.app`
- Health: `GET /api/health`
- Readiness: `GET /api/health/ready`

The GitHub Pages frontend is configured to use the SnapDeploy backend. The backend must allow the exact browser origin `https://narsing-s.github.io` in `ALLOWED_ORIGINS`.

The SnapDeploy deployment is a test deployment. Do not use its container filesystem as the only copy of irreplaceable memories.

## Backend deployment options

The repository is Dockerized and can be deployed to a Docker-capable host. `render.yaml` is included for Render-based deployment, and `docs/DEPLOYMENT.md` contains the deployment procedure and environment requirements.

For durable production, deploy these shared services:

```text
                    Web / Mobile / Desktop
                              |
                           HTTPS API
                              |
                         Node / Express
                    _________/ | \_________
                   /          |            \
              PostgreSQL    Redis       S3 / R2
                 |            |              |
                 +------------+--------------+
                              |
                       Background workers
               media / documents / AI / imports
```

Required durable production services:

- PostgreSQL + pgvector
- Redis/BullMQ
- S3-compatible object storage
- API service
- Media worker
- Document/OCR worker when enabled
- AI worker when enabled
- Notification worker
- Google import worker when enabled
- Realtime gateway when enabled

Production preflight intentionally fails closed when PostgreSQL, Redis, object storage or required encryption configuration is missing.

## Persistence and media

Production uploads use the storage adapter and private-media path. Object storage can be S3-compatible, Cloudflare R2 or MinIO for self-hosted environments. PostgreSQL migrations are applied in order by the production startup path.

The repository also contains:

- Checksummed PostgreSQL backups
- Backup verification and restore-drill tooling
- Retention tooling
- Safe orphan-media cleanup with dry-run mode
- Durable job/import lifecycle records
- Stale-job reconciliation
- Health/readiness checks
- Production doctor/preflight checks

## Authentication and privacy

- Passwords are bcrypt-hashed.
- JWT authentication is supported.
- Production requires a non-default JWT secret.
- Refresh-token rotation/revocation is implemented in the production runtime.
- Memory and media access is user-scoped.
- Provider credentials are encrypted at rest when the production integration path is used.
- CORS is explicit.
- Security headers and rate limiting are enabled.
- Media can be served through authenticated access/signed object storage rather than a public upload directory.
- Never commit passwords, API keys, JWT secrets, private photos, databases or user-uploaded data.

## External integrations

### Google Photos

The production integration path supports OAuth connection and resumable import jobs when Google OAuth credentials are configured. Import progress is stored and duplicate media is detected.

### Apple Photos

Apple Photos is intentionally not presented as a fake server-side import. Native/provider-specific authorization must be implemented and configured before an import can be reported as successful.

### AI

The production runtime has authenticated LLM and embedding provider hooks. AI responses must remain scoped to the authenticated user's memories. Provider credentials, quotas and budgets must be configured before enabling external generation.

### Documents/OCR

Authenticated document upload and durable document state are implemented. OCR execution requires an `OCR_COMMAND`/runtime provider configuration.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm test
JWT_SECRET="replace-with-a-long-random-secret" npm start
```

Open `http://localhost:4173`.

### Docker

```bash
docker build -t life-replay .
docker run --rm -p 4173:4173 \
  -e NODE_ENV=production \
  -e PORT=4173 \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  -v life-replay-data:/app/data \
  life-replay
```

For the full production dependency stack, use `infrastructure/docker/docker-compose.production.yml` and configure PostgreSQL, Redis, MinIO/object storage, ClamAV and the required workers.

## Deployment smoke test

After every deployment:

1. `GET /api/health` returns HTTP 200.
2. `GET /api/health/ready` reports required dependencies.
3. Register a test account.
4. Sign in and confirm Account shows the current user.
5. Use **Add Memory** and verify the memory survives refresh.
6. Test Timeline, Favorites, Trash and Map.
7. Test document upload if OCR is configured.
8. Test Google connection/import only when Google OAuth is configured.
9. Verify protected media requires authentication.
10. Run `npm run doctor` against the durable deployment.
11. Run backup verification/restore checks according to `docs/operations/PRODUCTION-SCHEDULES.md`.

## Documentation

- `docs/API.md` — API reference
- `docs/ARCHITECTURE.md` — architecture and storage model
- `docs/DEPLOYMENT.md` — deployment procedure
- `docs/BACKEND-HOSTING.md` — backend hosting options and durable deployment
- `docs/PRODUCTION-STATUS.md` — implementation status and release gate
- `docs/FEATURE-COVERAGE.md` — UI and backend capability matrix
- `docs/TEST-MATRIX.md` — end-to-end test matrix
- `docs/RELEASE-CHECKLIST.md` — release acceptance checklist
- `docs/KNOWN-LIMITATIONS.md` — known limitations
- `docs/SECURITY-CONTROLS.md` — security controls
- `docs/QUALITY-GATES.md` — quality gates
- `docs/operations/PRODUCTION-SCHEDULES.md` — backups, cleanup, reconciliation and workers

## Production release gate

Do not describe the service as a durable lifetime-memory backup until all of the following are true against the real deployment:

- PostgreSQL is reachable and migrations are current.
- Redis/BullMQ is reachable.
- All media is stored in durable object storage.
- Private media access is authenticated/signed.
- API restart does not lose memories or media.
- A second API instance can access the same user data.
- Backup verification succeeds.
- A restore drill succeeds.
- Stale jobs reconcile correctly.
- Orphan-media cleanup runs in dry-run mode before deletion is enabled.
- Browser E2E tests pass.
- Monitoring and alerting are configured.

## License

MIT — see `LICENSE`.