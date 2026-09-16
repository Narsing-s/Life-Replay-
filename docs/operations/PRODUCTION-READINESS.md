# Production readiness gate

A deployment is production-ready only when all required runtime dependencies are configured and reachable.

## Required

- PostgreSQL with the Life Replay migrations applied.
- Redis for distributed queues and coordination.
- S3-compatible object storage for durable media.
- A strong `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY`.
- HTTPS frontend origin in `ALLOWED_ORIGINS` / `FRONTEND_URL`.
- HTTP API and every required worker deployed from the same release.
- Scheduled PostgreSQL backups and tested restore procedure.

## Strongly recommended

- Email provider for verification and password reset.
- LLM provider for conversational AI.
- Embedding provider for semantic search.
- ClamAV or another malware scanning service.
- FFmpeg for video processing.
- OpenTelemetry/metrics exporter for operational visibility.

## Before opening access

1. Run `npm run check`.
2. Run `npm test`.
3. Run `npm run preflight` with production variables.
4. Run `npm run migrate:run` against the target PostgreSQL instance.
5. Run `npm run doctor` and require `ok: true`.
6. Create a real account and verify login/logout/refresh.
7. Upload an image and verify it is stored in object storage and served through the authenticated media endpoint.
8. Exercise memory create/update/delete/restore.
9. Exercise export and account deletion in a disposable account.
10. Verify a backup can be restored into a disposable database.
11. Confirm provider integrations show `not_configured` until their credentials and authorization are actually present.

## Explicit non-fakes

Google Photos, Apple Photos, email delivery, AI, OCR, malware scanning, transcoding and notifications must report their real provider state. The application must not display a successful import, scan, transcription, delivery or AI result when only a queue job was created.
