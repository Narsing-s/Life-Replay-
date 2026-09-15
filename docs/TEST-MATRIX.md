# Life Replay — End-to-End Test Matrix

## Base URLs

Frontend:

`https://narsing-s.github.io/Life-Replay-/`

Backend:

`https://life-replay-api-91493.containers.snapdeploy.app`

## 1. Availability

| Test | Expected |
|---|---|
| `GET /api/health` | HTTP 200, `ok: true` |
| `GET /api/health/ready` | HTTP 200, `database: true` |
| Browser frontend load | No blank page or console-blocking error |
| CORS preflight | HTTP 204 and correct `Access-Control-Allow-Origin` |

## 2. Authentication

| Test | Expected |
|---|---|
| Register valid account | HTTP 201 + token |
| Duplicate email | HTTP 409 |
| Invalid registration | HTTP 400 |
| Login valid credentials | HTTP 200 + token |
| Login wrong password | HTTP 401 |
| `/api/me` without token | HTTP 401 |
| `/api/me` with token | HTTP 200 |
| Profile open | HTTP 200 |
| Profile save | HTTP 200 |
| Logout | Token removed client-side |

## 3. Memories

| Test | Expected |
|---|---|
| Create memory without media through v1 JSON | HTTP 201 |
| Create memory with image | HTTP 201 |
| Edit title/caption/place/date | HTTP 200 |
| Favorite | Toggle succeeds |
| Pin | Toggle succeeds |
| Search by text | Matching memories returned |
| Filter by date | Correct date range |
| Filter by place | Correct place |
| Filter by category | Correct category |
| Filter by person | Correct person |
| Filter by tag | Correct tag |
| Trash | Memory hidden from normal list |
| Restore | Memory returns to normal list |
| Permanent delete | Memory no longer exists |

## 4. Media

Test each separately:

- JPEG
- PNG
- WebP
- GIF
- HEIC/HEIF where browser/platform supports it
- Small video
- Small audio
- PDF

Expected:

- Valid media succeeds.
- Unsupported MIME type is rejected.
- Oversized media receives a clear 413 response.
- Large images are compressed by the enhanced UI before the normal upload endpoint.
- Upload failure leaves the memory modal open and shows an actionable error.

## 5. Timeline

- Timeline returns current user's memories.
- Calendar shows memory dates.
- Favorites only returns favorite memories.
- On This Day matches month/day.
- People filter does not return another user's records.
- Places filter works.
- Tags filter works.
- Trash only shows deleted memories.
- Map endpoint returns user-scoped locations.

## 6. Replay and AI

- Ask my life with a normal question.
- Ask using a year such as `2025`.
- Ask using a month such as `January`.
- Ask using a place/person keyword.
- Empty question is rejected.
- No result produces a safe empty answer.
- Results never contain another user's memories.

The current implementation is an authenticated timeline-query layer. A production generative AI provider can be added later behind the same authorization boundary.

## 7. Account/data

- Export data downloads JSON.
- Export contains only the authenticated user's records.
- Sessions lists current user's sessions.
- Logout-all revokes recorded refresh sessions.
- Privacy controls remain user-scoped.

## 8. Sharing

- Create a share token.
- Open public share endpoint without authentication.
- Confirm only intended shareable data is returned.
- Invalid token returns 404.
- Confirm private account data is not returned through public sharing.

## 9. External integrations

Google Photos and Apple Photos should not be marked as “working imports” until provider OAuth/API credentials and the complete import flow are configured and tested.

Voice-to-memory:

- Chrome/Edge microphone permission.
- Speech is transcribed.
- Transcript becomes a memory draft.
- User explicitly saves the draft.

## 10. Mobile/browser

Test on:

- Desktop Chrome/Edge
- Android Chrome
- iPhone Safari
- Tablet browser
- Narrow 320px viewport
- 375px viewport
- 768px viewport
- Desktop 1440px viewport

Check that no important action is hidden or unreachable.

## 11. Security smoke tests

- Change user A's bearer token to user B's token and attempt user A memory access.
- Attempt a memory ID belonging to another user.
- Attempt a malformed JWT.
- Attempt upload with unsupported MIME type.
- Attempt upload above limit.
- Verify CORS rejects unknown origins.
- Verify security headers are present.
- Verify production startup fails with the default JWT secret.

## 12. Deployment acceptance

A deployment is accepted only when:

1. Health passes.
2. Registration/login pass.
3. Profile pass.
4. Create/edit/search memory pass.
5. Upload pass.
6. Favorite/pin/trash/restore pass.
7. Timeline/map/AI/export pass.
8. Mobile smoke test passes.
9. No unexpected 404/401/403/413/500 errors appear in browser console during the above tests.
10. Backend logs show no unhandled exception.

## Known expected messages

The following are not API failures when provider credentials are not configured:

- Google Photos provider configuration required.
- Apple Photos provider configuration required.

These should be replaced by real OAuth/import flows before production release.
