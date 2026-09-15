# Life Replay

**Remember the way it felt.**

Life Replay is a mobile-first personal memory product for turning photos, videos, audio and life moments into a private, searchable visual timeline.

## Current product

The existing **Memory Atlas** UI is intentionally preserved: dark editorial styling, gold accents, memory wall, timeline navigation, replay entry point, account controls and responsive mobile/desktop layout.

The current backend provides authenticated users, user-scoped memories, media uploads, profile controls, favorites/pins, trash/recovery, tags, people, locations, sessions, sharing, audit records, AI-style timeline queries, export and health/readiness endpoints.

## Production test deployment

The current test backend is deployed on SnapDeploy:

`https://life-replay-api-91493.containers.snapdeploy.app`

Health checks:

- `GET /api/health`
- `GET /api/health/ready`

The GitHub Pages frontend is:

`https://narsing-s.github.io/Life-Replay-/`

The enhanced frontend is configured to use the SnapDeploy backend when opened from GitHub Pages. The backend CORS allow-list must contain the browser origin exactly:

`https://narsing-s.github.io`

Do not include `/Life-Replay-` in the CORS origin because browser `Origin` headers contain the scheme and host, not the path.

## Core API

Authentication:

- `POST /api/auth/register` — `{ name, email, password }`
- `POST /api/auth/login` — `{ email, password }`
- `GET /api/me` — Bearer token
- `GET /api/v1/profile` — Bearer token
- `PATCH /api/v1/profile` — Bearer token
- `GET /api/v1/sessions` — Bearer token
- `POST /api/v1/auth/refresh` — Bearer token
- `POST /api/v1/auth/logout-all` — Bearer token

Memory operations:

- `GET /api/v1/memories`
- `POST /api/v1/memories`
- `PATCH /api/v1/memories/:id`
- `DELETE /api/v1/memories/:id` — moves a memory to trash
- `POST /api/v1/memories/:id/restore`
- `DELETE /api/v1/memories/:id/permanent`
- `POST /api/v1/memories/:id/favorite`
- `POST /api/v1/memories/:id/pin`
- `POST /api/v1/memories/:id/media`

Discovery/data:

- Timeline and filtered memory queries
- Search with `q`
- Year/date filtering
- Place/category filtering
- People and tag filtering
- Favorites and trash
- Map/location data
- JSON export
- User-scoped AI/timeline questions

Sharing and safety:

- Public share-link support
- Per-user authorization
- Audit logging
- Security headers
- CORS handling
- Upload type and size validation
- Request/error handling

## Media uploads

The application accepts images, video, audio and PDF media. The normal `/api/memories` endpoint currently has a 100 MB application limit. The enhanced UI compresses large images before upload to reduce proxy failures while preserving the original media types for smaller files.

For lifetime production storage, **do not treat the container filesystem as permanent storage**. Use PostgreSQL/managed database storage for metadata and durable object storage such as S3-compatible storage, Cloudflare R2 or another persistent provider for media.

## External providers

Google Photos and Apple Photos are intentionally shown as provider integrations rather than fake working imports. Full imports require the corresponding OAuth/API configuration and user authorization. A Google Client ID alone does not implement the complete Google Photos import flow.

Voice-to-memory uses browser speech recognition where supported and converts the captured transcript into a memory draft.

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
docker run -p 4173:4173 \
  -e NODE_ENV=production \
  -e JWT_SECRET="replace-with-a-long-random-secret" \
  -v life-replay-data:/app/data \
  life-replay
```

The container listens on `0.0.0.0` and uses the platform-provided `PORT` when supplied.

## Testing after every deployment

Run the following smoke tests before accepting a deployment:

1. `GET /api/health` returns HTTP 200.
2. `GET /api/health/ready` reports `database: true`.
3. Register a new test account.
4. Log in and retain the returned bearer token.
5. Open Profile and save a bio.
6. Create a small memory.
7. Upload a photo under the upload limit.
8. Query Timeline/Favorites/Trash/Map.
9. Ask the timeline assistant a question about the test memory.
10. Export account data.
11. Sign out and confirm protected endpoints require authentication.
12. Register/login from a second browser or mobile device to confirm the API is not tied to one client.

See `docs/PRODUCTION-STATUS.md` and `docs/TEST-MATRIX.md` for the detailed checklist.

## Security

- Passwords are bcrypt-hashed.
- JWTs are signed server-side.
- Production requires a non-default `JWT_SECRET`.
- Memory queries are scoped to the authenticated user.
- Upload filenames are generated server-side.
- Public share tokens are random high-entropy values.
- CORS is explicit.
- Security response headers are enabled.
- Never commit passwords, API keys, JWT secrets, private photos, databases or user-uploaded data.

## Important production limitations

The current SnapDeploy test deployment is suitable for end-to-end application testing, but the local SQLite database and container filesystem are not a complete durable-storage architecture for a lifetime-memory product. Before treating the service as a production backup of irreplaceable memories, migrate to:

1. Managed PostgreSQL.
2. Durable object storage for all media.
3. Signed media URLs.
4. Automated database backups and restore tests.
5. Background media processing and thumbnail generation.
6. Distributed rate limiting/session storage.
7. Email verification/password recovery delivery.
8. Complete Google Photos and Apple Photos OAuth/import flows.
9. Real AI provider integration with strict per-user authorization if generative AI is enabled.
10. Production monitoring, alerting and disaster-recovery procedures.

There is intentionally no artificial per-account memory-count limit in the application. Physical storage is finite and subject to the capacity, quota and cost of the selected database/object-storage provider; “unlimited” means no application-imposed memory-count cap, not literally infinite storage.

## Documentation

- `docs/API.md` — API reference
- `docs/ARCHITECTURE.md` — architecture and storage model
- `docs/PRODUCTION-STATUS.md` — implemented vs remaining production work
- `docs/TEST-MATRIX.md` — end-to-end test matrix
- `docs/DEPLOYMENT.md` — deployment guidance
- `docs/SECURITY-CONTROLS.md` — security controls
- `docs/FEATURE-COVERAGE.md` — feature coverage
- `docs/QUALITY-GATES.md` — quality gates

## Open-source project files

- [MIT License](LICENSE)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Support Guide](SUPPORT.md)
- [Changelog](CHANGELOG.md)

## Roadmap

### P0 — Complete the durable core

- Managed PostgreSQL
- Durable object storage
- Secure session/refresh-token rotation
- Email verification and password recovery delivery
- Complete memory editing and media lifecycle
- Backup/restore

### P1 — Intelligence

- Production AI provider integration
- AI summaries/captions
- Duplicate detection and media clustering
- Semantic search/embeddings
- Year-in-review and monthly reports
- Relationship/timeline intelligence

### P2 — Integrations and collaboration

- Google Photos OAuth/import
- Apple Photos integration where supported
- Calendar synchronization
- Family/friend collaboration
- Comments/reactions
- Granular share permissions and expiring links
- Notifications/reminders

### P3 — Production scale

- Background job queue
- Video transcoding/thumbnails
- Adaptive media delivery
- Monitoring and alerting
- Disaster recovery
- Mobile background indexing
- Native/mobile packaging where required
