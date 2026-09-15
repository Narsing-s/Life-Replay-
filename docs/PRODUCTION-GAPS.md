# Production gaps that require external infrastructure

The application code now exposes the product capabilities without pretending that external providers are configured.

Before calling the deployment production-grade, configure:

1. PostgreSQL or another managed durable relational database.
2. S3-compatible object storage for photos, video, audio and documents.
3. Transactional email for verification and password reset.
4. Google Photos OAuth credentials and approved callback URL.
5. Apple Photos/library integration where the target platform permits it.
6. AI provider credentials and model configuration.
7. A durable worker/queue for imports, thumbnails, EXIF extraction, AI jobs, duplicate processing and retries.
8. Managed backups and restore testing.
9. Monitoring/error tracking and log retention.
10. Map/geocoding provider if address lookup or map tiles are enabled.
11. Push notification infrastructure if browser/mobile push is required.
12. E2E browser/mobile test execution in CI against a deployed staging environment.

These are deployment/provider requirements, not UI placeholders. The API returns readiness/status information so the UI can report whether a provider is actually configured.
