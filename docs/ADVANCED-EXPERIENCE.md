# Life Replay — Advanced Experience

This release adds real authenticated discovery screens to the existing Memory Atlas. It intentionally reuses the existing API and does not create a parallel database or demo-data layer.

## Available in the web client

| Experience | Runtime behavior | API/data source |
|---|---|---|
| AI Assistant | Sends a question, attempts the configured LLM endpoint, and falls back to the authenticated timeline assistant. Displays related matches when returned. | `POST /api/v1/ai/ask/llm`, fallback `POST /api/v1/ai/ask` |
| Replay Studio | Creates and saves a date-scoped replay, displays the generated narrative and memories, and lists saved replays. | `POST/GET /api/v1/replays`, `GET /api/v1/replays/:id` |
| Memory Calendar | Month navigation and day selection over the signed-in user's memory dates. | `GET /api/memories` |
| Places | Groups memories by their recorded place/address. It does not invent GPS coordinates or claim to be a map. | `GET /api/memories` |
| Life Insights | Calculates memory counts by year/month and aggregates saved people/tags. | `GET /api/memories` |
| Data export | Downloads the server-provided account export. | `GET /api/v1/export` |

All views require an authenticated session. They use the existing account token and user-scoped endpoints. No sample memories are inserted.

## Honest capability boundaries

- Replay Studio creates a saved text/timeline replay. It does **not** render an MP4, synthesize narration, or add licensed music.
- Places is a recorded-place index, not an interactive map. A true map requires coordinates and a map provider.
- The AI Assistant uses the configured LLM endpoint when available and falls back to the existing authenticated timeline answer route. Semantic vector retrieval is not implied.
- The calendar is a memory-date calendar; it does not claim to synchronize Google/Apple calendars.
- Insights are descriptive counts from stored records, not psychological or health conclusions.
- Google Photos and Apple Photos imports remain provider-dependent and are not represented as connected by this UI.

## Validation

The CI syntax gate includes `advanced-experience.js`. Before release, run `npm install`, `npm run check`, `npm test`, and the authenticated browser smoke tests in `docs/TEST-MATRIX.md`.

## Next production milestones

1. Complete PostgreSQL runtime repository cutover and verify migrations on a production-data copy.
2. Move all media writes/reads to private object storage; add resumable uploads, quarantine, scanning, thumbnails and orphan reconciliation.
3. Add transactional outbox + durable worker retries/dead-letter handling for media and AI work.
4. Implement vector retrieval with per-user authorization and deletion synchronization.
5. Build actual MP4 rendering with isolated worker capacity, job progress, cancellation and storage quotas.
6. Add coordinate-backed maps and explicit calendar-provider OAuth/import sync.
7. Add browser E2E tests for login, upload, edit, delete/restore, replay, export, sharing and account deletion.
8. Perform backup restore drills, load tests and cross-account authorization tests before declaring production readiness.
