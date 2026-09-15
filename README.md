# Life Replay

**Turn your life into a story.**

Life Replay is a mobile-first memory product built around **capture → remember → replay → share**.

## Product direction

Life Replay is being built as a privacy-first personal memory system, not just a photo gallery. The long-term experience is:

**Capture → organize automatically → rediscover → cinematic replay → share safely**.

## Phase 2 production foundation

- Email/password registration and login
- JWT sessions
- SQLite persistence for local/self-hosted deployments
- Private per-user memories
- Image uploads up to 25 MB
- User-owned deletion of uploaded media
- Public share-link tokens that expose only the owner's story data
- Health endpoint for deployment checks
- Production Dockerfile
- Environment configuration through `JWT_SECRET`, `PORT`, and `DATA_DIR`

The current backend is a foundation. The production hosted version should move durable data to managed PostgreSQL and object storage before handling important user memories at scale.

### API

`GET /api/health`

`POST /api/auth/register` — `{ "name", "email", "password" }`

`POST /api/auth/login` — `{ "email", "password" }`

`GET /api/me` — Bearer token required

`GET /api/memories` — Bearer token required

`POST /api/memories` — multipart image upload, Bearer token required

`DELETE /api/memories/:id` — Bearer token required

`POST /api/share` — creates a public story token

`GET /api/share/:token` — reads a public story

## Product-grade roadmap

### P0 — Trust and reliability

1. Managed PostgreSQL for users, memories, shares and metadata.
2. Object storage for original media plus generated thumbnails.
3. Secure httpOnly session cookies with refresh-token rotation and session revocation.
4. Email verification, password recovery and account deletion/export.
5. Request rate limiting, abuse protection, security headers and strict upload validation.
6. Automated backups, health checks, structured logs and error monitoring.
7. Privacy controls: private by default, per-memory visibility, expiring share links and revoke access.

### P1 — The magic

8. EXIF date/location extraction with explicit location-consent controls.
9. Automatic timeline grouping by day, trip, event and place.
10. AI captions and memory summaries that users can edit or reject.
11. Duplicate/near-duplicate detection so users do not repeatedly upload the same photo.
12. Smart search: people, places, dates, captions and natural-language queries.
13. Automatic monthly, yearly and life-milestone story generation.
14. Cinematic replay with music, transitions, captions and duration controls.

### P2 — Sharing and retention

15. Beautiful public story pages with Open Graph previews.
16. Share controls: public, unlisted, password protected, expiration and revoke.
17. Family/friend collaboration with owner-controlled permissions.
18. Reactions/comments with moderation and notification controls.
19. Memories resurfaced through “On this day”, anniversaries and yearly recaps.
20. Downloadable story/video export.

### P3 — Growth and mobile

21. Installable PWA with offline capture and background sync.
22. Native Android/iOS clients when usage justifies them.
23. Referral links, private invite flows and shareable yearly recap campaigns.
24. Premium tiers around storage, AI processing, cinematic exports and family sharing.
25. Accessibility, localization and low-bandwidth media optimization for global users.

## Vercel deployment architecture

For a hosted production deployment, do **not** rely on Vercel's ephemeral function filesystem for the SQLite database or uploaded photos. Use:

```text
Vercel
 ├── Web application + API functions
 ├── PostgreSQL
 └── Object storage
       ├── original photos
       ├── thumbnails
       └── generated story/video assets
```

The current Docker/Express server remains useful for local and self-hosted deployments. A Vercel adapter should expose the API as serverless functions rather than starting a long-lived `app.listen()` process.

### Environment variables

- `JWT_SECRET` — long random secret; never commit it
- `DATABASE_URL` — managed PostgreSQL connection string for hosted production
- `STORAGE_*` — object-storage credentials/configuration
- `APP_URL` — canonical public application URL
- `AI_*` — optional AI provider configuration

## Run the production foundation locally

```bash
npm install
JWT_SECRET="replace-with-a-long-random-secret" npm start
```

Open `http://localhost:4173`.

For Docker:

```bash
docker build -t life-replay .
docker run -p 4173:4173 -e JWT_SECRET="replace-with-a-long-random-secret" -v life-replay-data:/app/data life-replay
```

### Important deployment note

The SQLite database and uploaded media are stored under `DATA_DIR`. Production hosting must use a persistent volume or replace this storage layer with managed PostgreSQL + object storage. Do **not** deploy with the example JWT secret.

## Security boundaries

- Passwords are bcrypt-hashed and never returned by the API.
- JWTs are signed server-side; use a long random `JWT_SECRET` in production.
- Memory listing and deletion are scoped to the authenticated user.
- Uploaded filenames are replaced with random IDs.
- Public links use high-entropy random tokens.
- Public share endpoints intentionally return story metadata and media URLs only; they do not expose passwords or account credentials.

## Definition of “market-ready”

Life Replay should not be considered production-ready merely because the landing page deploys. Before inviting real users, the release must pass: registration/login, authenticated capture, media persistence, deletion, sharing/revocation, password recovery, account export/deletion, responsive mobile UX, accessibility checks, backup/restore validation, security checks and end-to-end browser tests.
