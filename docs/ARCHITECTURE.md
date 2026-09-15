# Life Replay Architecture

## Product layers

```text
Browser / Mobile Web
        |
        v
Memory Atlas UI (index.html)
        |
        | HTTPS JSON / multipart requests
        v
Node.js + Express API
        |
        +--> JWT authentication
        +--> bcrypt password hashing
        +--> SQLite database
        +--> uploaded media storage
        +--> public share tokens
        |
        v
Persistent production volume
```

## Frontend

The current frontend is a zero-build Memory Atlas experience. It renders the application shell, demo memories, authentication UI, search, timeline navigation, replay entry point, and account controls.

When hosted on GitHub Pages, API requests are routed to the configured production backend rather than to the static Pages origin.

## Backend

The Express server exposes health/configuration endpoints and authenticated APIs for registration, login, current-user data, memories, uploads, deletion, and share links.

Private memory APIs require a valid Bearer JWT. Memory queries and deletion operations are scoped to the authenticated user.

## Storage

SQLite stores users, memories, and share-link metadata. Uploaded media is stored under the configured data directory.

Production deployments must mount persistent storage. For larger production deployments, the recommended evolution is managed PostgreSQL plus S3-compatible object storage.

## Authentication

Registration accepts name, email, and an 8+ character password. Passwords are bcrypt-hashed. Successful registration and login return a signed JWT used for authenticated API calls.

The JWT signing secret must be provided through `JWT_SECRET` in production and must never be committed to the repository.

## Configuration

| Variable | Purpose |
|---|---|
| `PORT` | HTTP server port |
| `JWT_SECRET` | JWT signing secret |
| `DATA_DIR` | SQLite and upload storage directory |
| `GOOGLE_CLIENT_ID` | Google integration configuration |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

## Deployment

### GitHub Pages

The static frontend can be published from `main` / `/(root)` using GitHub Pages' Deploy from a branch option.

### Docker

The repository includes a production Dockerfile. The container listens on port `4173` and should be paired with persistent storage for `/app/data`.

### Render

`render.yaml` defines the backend service, health check, production environment variables, and persistent disk configuration.

## Security boundaries

- Client-side code is public and must not contain secrets.
- JWT secrets belong only in server-side environment variables.
- Private memory operations must remain authenticated.
- CORS should be restricted to trusted application origins.
- Production deployments must use HTTPS.
