# Life Replay feature coverage

The current product exposes the existing Memory Atlas UI while wiring its controls to the authenticated API.

## Implemented in the repository

- Registration and login
- Profile and privacy controls
- Password change and reset-token flows
- Email verification-token flow
- Session/device management and logout-all
- Create/list/update/trash/restore/permanently-delete memories
- Image/video/audio/document media upload with size/MIME checks
- Media checksums and duplicate detection
- Memory timestamps, places, coordinates, categories, mood, people and tags
- Favorites and pinned memories
- Timeline, calendar, search and filters
- Trash/recovery
- On This Day
- Replay generation and year/month replay entry points
- AI natural-language questions with authenticated-user-only memory context
- AI summary generation
- Shared links
- Collaborators, comments and reactions
- Notifications and calendar events
- Import entry points for Google Photos and Apple Photos
- Browser voice-to-memory transcription entry point
- Data export and account deletion
- Audit/security events
- Request IDs, security headers and authentication rate limiting for reset requests
- PWA service-worker support
- Storage/backup/AI readiness endpoints

## Production provider configuration still required

Some capabilities require external credentials or durable infrastructure and are deliberately represented as provider-ready interfaces rather than fake functionality:

- Durable PostgreSQL production database
- S3-compatible/object storage for media
- Email delivery provider for verification/reset messages
- Google Photos OAuth credentials
- Apple Photos/library integration approved by the platform
- Production AI provider key/model
- Durable background queue/worker infrastructure
- Managed database/media backups and disaster recovery
- Production map/geocoding provider
- Push notification provider

The UI keeps the existing visual language; these controls are surfaced through the existing navigation and modal patterns rather than a redesign.
