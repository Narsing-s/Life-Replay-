# Life Replay — Production Status

Updated: 2026-09-16

## Current deployment

- Frontend: GitHub Pages
- Backend: SnapDeploy
- Backend URL: `https://life-replay-api-91493.containers.snapdeploy.app`
- Runtime: Node/Express
- Database in current test deployment: SQLite
- Media in current test deployment: container filesystem

## Implemented

### Authentication

- Registration
- Email/password login
- JWT authentication
- Protected API routes
- Profile retrieval/update
- Session records
- Logout-all endpoint
- Production JWT secret validation

### Memories

- Create memories
- Edit memories
- Trash/recovery
- Permanent deletion
- Favorites
- Pinning
- Date/place/category filters
- People and tags
- Media records
- Duplicate checksum detection for v1 media uploads
- User-scoped authorization

### Discovery

- Timeline queries
- Text search through the memory API
- Date/year filters
- Place/category filters
- Person/tag filters
- Favorites
- Trash
- On This Day UI logic
- Map/location endpoint

### Data and privacy

- JSON export
- Audit logs
- Security headers
- CORS
- Upload MIME validation
- Upload size validation
- Per-user memory authorization

### Experience

- Existing Memory Atlas UI retained
- Responsive layout
- Account controls
- Timeline controls
- Replay/AI controls
- Media upload
- Browser voice-to-memory where supported
- PWA assets

## Fixed during SnapDeploy testing

The following failures were found from browser testing and corrected in `main`:

- `/api/v1/profile` returning 404
- `/api/v1/memories` returning 404
- `/api/v1/export` returning 404
- `/api/v1/ai/ask` returning 404
- `/api/v1/map` returning 404
- Frontend still pointing to the old Render URL
- Multipart requests incorrectly receiving JSON content type from the enhanced UI
- Upload size handling returning an unclear 413
- Large image uploads unnecessarily hitting proxy limits
- Voice-to-memory lacking a working browser implementation

After these commits are deployed, perform the smoke tests in `docs/TEST-MATRIX.md` again.

## Remaining before calling this a production backup of irreplaceable memories

### Storage

- [ ] Managed PostgreSQL
- [ ] Durable object storage for media
- [ ] Signed/private media URLs
- [ ] Storage lifecycle policies
- [ ] Automated backups
- [ ] Restore verification

### Authentication/security

- [ ] Rotating refresh tokens with replay detection
- [ ] HttpOnly secure cookie option
- [ ] Email verification delivery
- [ ] Password-reset delivery
- [ ] Distributed rate limiting
- [ ] Device/session revocation UI
- [ ] Account deletion workflow with confirmation and retention policy

### Media pipeline

- [ ] EXIF extraction with explicit consent
- [ ] Thumbnail generation
- [ ] Video transcoding
- [ ] Image optimization pipeline
- [ ] Background processing queue
- [ ] Malware/content scanning for uploads
- [ ] Durable media checksum index

### AI

- [ ] Production AI provider integration
- [ ] Embeddings/vector search
- [ ] AI summaries/captions
- [ ] AI-generated yearly/monthly reports
- [ ] Strict AI authorization and prompt/data isolation
- [ ] AI cost/rate controls

### External integrations

- [ ] Google Photos OAuth and import
- [ ] Apple Photos integration where supported
- [ ] Calendar synchronization
- [ ] Notification delivery

### Collaboration

- [ ] Shared memory permissions UI
- [ ] Family/friend invitations
- [ ] Comments UI
- [ ] Reactions UI
- [ ] Expiring/password-protected share links UI
- [ ] QR/share-card generation

### Reliability/operations

- [ ] Background job queue with retry/idempotency
- [ ] Structured logs and request correlation
- [ ] Error tracking
- [ ] Metrics/alerts
- [ ] Database migration strategy
- [ ] Disaster-recovery runbook
- [ ] Load testing
- [ ] Browser/mobile E2E suite in CI

## Definition of production-ready

Life Replay should only be advertised as a durable lifetime-memory service after the storage, backup/restore, media durability, authentication recovery, monitoring and disaster-recovery items above are completed.

The current SnapDeploy deployment is the correct environment for end-to-end functional testing, not a substitute for durable storage architecture.
