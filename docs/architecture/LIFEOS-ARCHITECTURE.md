# LifeOS Architecture

## Target runtime

Clients (Web, Mobile, Desktop) connect to the API/BFF. The BFF owns authentication, REST APIs and realtime/WebSocket access. Domain boundaries are Identity, Life, AI Orchestrator, Documents/OCR, Search and Memory. Durable state belongs in PostgreSQL, media in S3-compatible object storage, vectors in a vector-capable PostgreSQL index, and asynchronous work in Redis/BullMQ.

## Current implementation

- API/BFF: `server.js` + route modules.
- Identity/auth: bearer JWT, email verification/reset flows and refresh-token rotation.
- Life/memory: implemented through `feature-routes.js`.
- AI: local deterministic search plus optional OpenAI-compatible LLM/embeddings; no provider is faked when unconfigured.
- Google integration: OAuth foundation with encrypted server-side tokens.
- Queue: BullMQ adapter and worker boundaries exist; production requires Redis.
- Object storage: S3/R2 adapter exists; production requires credentials and migration of media records.
- PostgreSQL: production preflight requires it, but the legacy runtime database layer is still SQLite. This is the main migration blocker.

## Migration rule

A provider is considered **Connected** only after configuration and a live smoke test. Code scaffolding or environment variable presence alone is not proof of connectivity.

## Security rules

1. Never expose provider access/refresh tokens to clients.
2. Never claim an import occurred unless provider API calls returned imported records.
3. User data must always be scoped by authenticated user ID.
4. Production media should be private and served with short-lived authorization/signed URLs.
5. Production readiness requires PostgreSQL + object storage + Redis and verified backup/restore procedures.
