# Life Replay

**Turn your life into a story.**

Life Replay is a mobile-first memory product built around **capture → remember → replay → share**.

## Phase 2 production foundation

This branch adds a real backend foundation while keeping the existing MVP UI intact:

- Email/password registration and login
- JWT sessions
- SQLite persistence
- Private per-user memories
- Image uploads up to 25 MB
- User-owned deletion of uploaded media
- Public share-link tokens that expose only the owner's story data
- Health endpoint for deployment checks
- Production Dockerfile
- Environment configuration through `JWT_SECRET`, `PORT`, and `DATA_DIR`

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

## Next production layers

1. Managed PostgreSQL + S3-compatible object storage
2. Refresh-token rotation and secure httpOnly cookie sessions
3. Email verification and password recovery
4. EXIF extraction with explicit location consent
5. AI captions, clustering and duplicate detection
6. Thumbnail/video processing and cinematic replay generation
7. Granular share permissions and expiring links
8. Mobile background indexing
9. Collaborative family/friend memories
10. Viral templates, referral links and yearly recap campaigns
