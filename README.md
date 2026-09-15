# Life Replay

**Remember the way it felt.**

Life Replay is a mobile-first memory product for turning photos and moments into a visual, searchable personal timeline.

## Current product

The current frontend is the **Memory Atlas** experience:

- Editorial home dashboard
- Visual memory wall
- Timeline / time-machine browsing
- Full-screen Replay viewer
- Search across memories, dates and places
- Google Photos import entry point
- Account/authentication entry points
- Responsive desktop, tablet and mobile layout
- Offline demo memories so the UI never depends on an API just to render

The production backend provides authenticated memory storage, image uploads, sharing and health checks.

## GitHub Pages

For the static frontend, publish the repository directly from `main` / `/(root)` using **Deploy from a branch**. This avoids the previous Actions `configure-pages` integration failure.

Open repository Pages settings:

`https://github.com/Narsing-s/Life-Replay-/settings/pages`

Set:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/(root)`

The expected project URL is:

`https://narsing-s.github.io/Life-Replay-/`

GitHub Pages can take several minutes to publish after the source is configured or new commits are pushed.

## Production backend

The Node/Express backend supports:

- Email/password registration and login
- JWT sessions
- SQLite persistence
- Private per-user memories
- Image uploads up to 25 MB
- User-owned deletion of uploaded media
- Public share-link tokens
- Health endpoint
- Docker deployment
- Configurable `JWT_SECRET`, `PORT`, `DATA_DIR`, `GOOGLE_CLIENT_ID` and `ALLOWED_ORIGINS`

### API

`GET /api/health`

`GET /api/config`

`POST /api/auth/register` — `{ "name", "email", "password" }`

`POST /api/auth/login` — `{ "email", "password" }`

`GET /api/me` — Bearer token required

`GET /api/memories` — Bearer token required

`POST /api/memories` — multipart image upload, Bearer token required

`DELETE /api/memories/:id` — Bearer token required

`POST /api/share` — creates a public story token

`GET /api/share/:token` — reads a public story

## Run locally

```bash
npm install
JWT_SECRET="replace-with-a-long-random-secret" npm start
```

Open `http://localhost:4173`.

### Docker

```bash
docker build -t life-replay .
docker run -p 4173:4173 -e JWT_SECRET="replace-with-a-long-random-secret" -v life-replay-data:/app/data life-replay
```

Production hosting must use a persistent volume for the SQLite database and uploaded media, or replace this storage layer with managed PostgreSQL plus object storage.

## Security

- Passwords are bcrypt-hashed and never returned by the API.
- JWTs are signed server-side; production must use a long random `JWT_SECRET`.
- Memory listing and deletion are scoped to the authenticated user.
- Uploaded filenames are replaced with random IDs.
- Public links use high-entropy random tokens.
- Public share endpoints do not expose passwords or account credentials.

## Roadmap

1. Managed PostgreSQL + S3-compatible object storage
2. Refresh-token rotation and secure httpOnly cookie sessions
3. Email verification and password recovery
4. EXIF extraction with explicit location consent
5. AI captions, clustering and duplicate detection
6. Thumbnail/video processing and cinematic replay generation
7. Granular share permissions and expiring links
8. Mobile background indexing
9. Collaborative family/friend memories
10. Viral yearly recap and referral campaigns
