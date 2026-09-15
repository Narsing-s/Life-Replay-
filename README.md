# Life Replay

**Remember the way it felt.**

Life Replay is a mobile-first memory product for turning photos and moments into a visual, searchable personal timeline.

## Current product

The current frontend is the **Memory Atlas** experience:

- Editorial home dashboard
- Visual memory wall
- Timeline / time-machine browsing
- Replay viewer entry point
- Search across memories, dates and places
- Google Photos import entry point
- Account/authentication entry points
- Responsive desktop, tablet and mobile layout
- Offline demo memories so the UI never depends on an API just to render

The production backend provides authenticated memory storage, image uploads, sharing and health checks.

## Deploy the backend to Render

The repository includes a ready-to-use `render.yaml` Blueprint for the Node/Express backend, persistent SQLite storage and the `/api/health` health check.

**Fastest option:** use the Render deployment button below. Render will read the Blueprint from this public repository and ask you to approve the resources before creating the service. citeturn0search0

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Narsing-s/Life-Replay-)

After deployment, Render will provide an `*.onrender.com` service URL. The frontend is already configured to use `https://life-replay.onrender.com` when served from GitHub Pages; if Render assigns a different subdomain, update the `BACKEND` constant in `index.html` and the `ALLOWED_ORIGINS` value in `render.yaml` to match it.

Alternatively, in Render choose **New → Blueprint**, connect this repository, keep the Blueprint path as `render.yaml`, review the service, and deploy it. Render's Blueprint flow provisions the resources declared in the YAML file. citeturn0search2

The backend requires a generated production `JWT_SECRET`. The Blueprint already marks it with `generateValue: true`. `GOOGLE_CLIENT_ID` is optional and can be configured later.

## Open-source project files

- [MIT License](LICENSE)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Support Guide](SUPPORT.md)
- [Changelog](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Testing Guide](docs/TESTING.md)

## Quality and security automation

Every push and pull request targeting `main` is checked by GitHub Actions for:

- Node.js syntax validation
- Automated API/authentication tests
- High-severity production dependency vulnerabilities
- Docker image build health
- CodeQL security analysis
- Dependency changes on pull requests

Dependabot is configured for npm dependencies and GitHub Actions. These checks are intended to catch regressions and supply-chain risks before production deployment.

## GitHub Pages

The repository contains a top-level `index.html`, so the simplest GitHub Pages setup is **Deploy from a branch** using `main` and `/(root)`. GitHub recommends branch publishing when no custom build process is required. citeturn0search1

Open repository Pages settings:

`https://github.com/Narsing-s/Life-Replay-/settings/pages`

Set:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/(root)`

Expected project URL:

`https://narsing-s.github.io/Life-Replay-/`

GitHub Pages requires the entry file at the top level of the selected publishing source. This repository provides `index.html` and `.nojekyll` at the root. citeturn0search3turn0search5

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

See the [API Reference](docs/API.md) and [Deployment Guide](docs/DEPLOYMENT.md) for details.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm install
npm test
JWT_SECRET="replace-with-a-long-random-secret" npm start
```

Open `http://localhost:4173`.

Use `.env.example` as the starting point for local configuration. Never commit real secrets.

### Docker

```bash
docker build -t life-replay .
docker run -p 4173:4173 -e JWT_SECRET="replace-with-a-long-random-secret" -v life-replay-data:/app/data life-replay
```

The production image runs as a non-root user and exposes a container healthcheck. Production hosting must use persistent storage for the SQLite database and uploaded media, or replace this storage layer with managed PostgreSQL plus object storage.

## API overview

`GET /api/health`

`GET /api/config`

`POST /api/auth/register` — `{ "name", "email", "password" }`

`POST /api/auth/login` — `{ "email", "password" }`

`GET /api/me` — Bearer token required

`GET /api/memories` — Bearer token required

`POST /api/memories` — multipart image upload, Bearer token required

`DELETE /api/memories/:id` — Bearer token required

`POST /api/share` — creates a public share token

`GET /api/share/:token` — reads a public story

## Security

- Passwords are bcrypt-hashed and never returned by the API.
- JWTs are signed server-side; production must use a long random `JWT_SECRET`.
- Memory listing and deletion are scoped to the authenticated user.
- Uploaded filenames are replaced with random IDs.
- Public links use high-entropy random tokens.
- Public share endpoints do not expose passwords or account credentials.
- Local database, upload and environment files are excluded from Git.

Never commit passwords, API keys, JWT secrets, private photos, databases, or user-uploaded data.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SUPPORT.md](SUPPORT.md) before opening an issue or pull request. Bug reports and feature requests have repository templates under `.github/ISSUE_TEMPLATE/`.

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
