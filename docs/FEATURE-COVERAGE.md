# Life Replay Feature Coverage

Updated: 2026-09-16

This matrix separates what is visible in the web UI from what is actually wired in the production API. A visible option is not considered operational merely because it has a button: provider-dependent capabilities must report their real configuration state.

| UI area | Visible | Backend/runtime | Provider/config needed | State |
|---|---:|---:|---:|---|
| Add Memory | Yes | Authenticated memory/media creation | No for basic upload | Implemented |
| Timeline | Yes | User-scoped memory queries | No | Implemented |
| Replay | Yes | Replay/job lifecycle | AI configuration for generated narrative | Implemented with provider dependency |
| Photos & Imports | Yes | Uploads + Google import jobs | Google OAuth for provider import | Implemented with provider dependency |
| Documents & OCR | Yes | Document upload + durable processing state | OCR command/provider | Implemented with provider dependency |
| Search & AI | Yes | Authenticated AI/timeline routes + embeddings path | LLM/embedding provider for external AI | Implemented with provider dependency |
| Map | Yes | User-scoped location data | No | Implemented |
| Calendar | Yes | Internal calendar/event storage | External calendar connector for sync | Internal capability implemented |
| People | Yes | User-scoped people records | No | Implemented |
| Tags | Yes | User-scoped tags | No | Implemented |
| Favorites | Yes | User-scoped memory metadata | No | Implemented |
| Trash | Yes | Soft delete/restore/permanent delete | No | Implemented |
| Background Jobs | Yes | Durable job/import records + workers | Redis/BullMQ for production workers | Implemented with infrastructure dependency |
| Account | Yes | Auth/profile/export/session routes | Email provider for verification/recovery | Implemented |
| Settings | Yes | Profile/security/provider state | Provider-specific configuration as applicable | Implemented |
| Integrations | Yes | Google OAuth connection/import lifecycle | Google OAuth credentials | Implemented with provider dependency |
| Notifications | Yes | Durable notification records/worker | Notification provider as required | Implemented with provider dependency |
| Security | Yes | Sessions, auth, rate limiting, security headers | Redis for distributed production limits | Implemented with infrastructure dependency |

## Storage and infrastructure

| Capability | Current implementation |
|---|---|
| PostgreSQL | Production runtime and ordered migrations |
| pgvector | PostgreSQL schema and embedding support |
| Redis | BullMQ queues and distributed production foundation |
| S3/R2/MinIO | Production storage adapter |
| Private media | Authenticated media access / signed object-storage capability |
| Media worker | Scan/process/transcode lifecycle |
| Document worker | OCR lifecycle when OCR provider is configured |
| AI worker | Authenticated AI job execution |
| Google import worker | Resumable, deduplicated import jobs |
| Notification worker | Durable delivery lifecycle |
| Backups | Checksums, verification, retention and restore tooling |
| Orphan cleanup | Bounded, reference-aware cleanup with dry-run default |
| Stale-job reconciliation | Detects and marks abandoned running jobs |
| Production doctor | Provider/connectivity/readiness diagnostics |
| Health/readiness | API and dependency health endpoints |

## Deliberately not claimed as complete

- Apple Photos server-side import is not enabled.
- External calendar synchronization is not enabled until a provider and authorization flow are configured.
- Native iOS/Android clients are not part of the current web deployment.
- Desktop packaging is not part of the current web deployment.
- A test SnapDeploy container is not treated as durable lifetime storage.

## UI contract

Every product capability should have a visible entry point or a visible status card. When a provider is unavailable, the UI should explain what configuration is missing and must not display a fabricated success state.

The account flow also follows these rules:

1. If a user is already authenticated, Account shows the current user instead of asking them to sign in again.
2. Add Memory remains available from the authenticated account flow.
3. Add another account explicitly switches into another authentication session.
4. Provider imports remain disabled until real provider authorization/configuration exists.
