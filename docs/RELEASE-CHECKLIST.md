# Life Replay — Release Checklist

Updated: 2026-09-16

## Current test deployment

- Frontend: GitHub Pages
- Backend: SnapDeploy
- Backend: `https://life-replay-api-91493.containers.snapdeploy.app`
- Branch: `main`

## 1. Deploy

- [ ] Pull latest `main`
- [ ] Build container successfully
- [ ] Container reports healthy
- [ ] Confirm `/api/health`
- [ ] Confirm `/api/health/ready`
- [ ] Confirm CORS for `https://narsing-s.github.io`

## 2. Authentication

- [ ] Register a new account
- [ ] Duplicate registration returns a controlled error
- [ ] Login succeeds
- [ ] Wrong password returns 401 without leaking account details
- [ ] Profile loads
- [ ] Profile update works
- [ ] Logout works
- [ ] Protected endpoint rejects missing/invalid token

## 3. Memories

- [ ] Create text memory
- [ ] Upload a small image
- [ ] Upload a compressed large image
- [ ] Edit memory
- [ ] Favorite/unfavorite
- [ ] Pin/unpin
- [ ] Search
- [ ] Filter by date/year
- [ ] Filter by place/category/person/tag
- [ ] Move to trash
- [ ] Restore from trash
- [ ] Permanently delete
- [ ] Confirm one user's memory cannot be accessed by another user

## 4. Replay and discovery

- [ ] Timeline
- [ ] Calendar
- [ ] On This Day
- [ ] Favorites
- [ ] Places/map
- [ ] Ask My Life
- [ ] Year/month report UI
- [ ] Best moments
- [ ] Memory summary
- [ ] Export

## 5. Media

- [ ] JPEG/PNG/WebP upload
- [ ] Unsupported MIME type rejected
- [ ] Oversized upload returns clear 413
- [ ] Duplicate media is detected where v1 checksum upload is used
- [ ] Media can be opened from the authenticated account

## 6. Browser/mobile

- [ ] Chrome desktop
- [ ] Edge desktop
- [ ] Android Chrome
- [ ] iPhone Safari
- [ ] Responsive navigation
- [ ] Add-memory flow on mobile
- [ ] Upload from mobile gallery
- [ ] Voice-to-memory where browser Speech Recognition is available
- [ ] PWA install prompt/manifest

## 7. Security

- [ ] Production JWT secret is configured
- [ ] No secrets committed to Git
- [ ] HTTPS only
- [ ] Security headers present
- [ ] CORS is restricted to intended origins
- [ ] Authorization is checked on every user-owned resource
- [ ] Upload MIME and size limits are enabled
- [ ] Audit events are written for important mutations

## 8. Not yet production-complete

The following must remain visibly marked as future work until implemented and tested:

- PostgreSQL
- Durable object storage
- Automated backup and restore verification
- Signed private media URLs
- Email verification delivery
- Password-reset delivery
- Distributed rate limiting
- Production AI provider/vector search
- Google Photos OAuth/import
- Apple Photos integration
- Calendar synchronization
- Production notification delivery
- Collaboration permissions UI
- Comments/reactions UI
- Production job queue
- Monitoring/error tracking/alerts
- Disaster recovery and load testing

## Release rule

Do not call the service a durable lifetime-memory production system until persistent storage, media durability, backups, restore testing, authentication recovery, monitoring and disaster recovery are complete.
