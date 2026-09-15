# Implementation checklist

## P0
- [x] Registration/login
- [x] Profile/privacy
- [x] Create/update/delete/restore memories
- [x] Media upload validation
- [x] Timestamp/place/people/tags/category
- [x] Timeline/calendar/search/filtering
- [x] Favorites/pinning/trash/export
- [x] Responsive UI

## P1
- [x] Natural-language memory questions
- [x] Memory summaries
- [x] On This Day
- [x] Replay/year/month reports
- [x] Photo duplicate checks
- [x] Memory relationships through replay/timeline data
- [x] Mood tagging
- [x] Voice-to-memory browser entry point

## P2
- [x] Shared links
- [x] Visibility controls
- [x] Collaborators/comments/reactions
- [x] Calendar/location endpoints
- [x] Notifications endpoints
- [x] PWA shell
- [x] Encryption in transit via HTTPS deployment requirement
- [x] Account deletion/export controls

## Security/operations
- [x] Password change/reset flow
- [x] Email verification-token flow
- [x] Session/device controls
- [x] Security headers
- [x] Request IDs
- [x] Rate limiting for reset requests
- [x] Audit/security events
- [x] AI user authorization scope
- [x] Readiness/status endpoints
- [x] CI test coverage for CORS/security basics

## External infrastructure still required
- [ ] Managed PostgreSQL production deployment
- [ ] Durable object storage
- [ ] Production email delivery
- [ ] Google/Apple provider credentials
- [ ] Production AI key
- [ ] Durable worker/queue
- [ ] Managed backups/restore verification
- [ ] Production monitoring/error tracking
- [ ] Real map/geocoding provider
- [ ] Production E2E/mobile device matrix
