# LifeOS Production Implementation Status

This document separates architecture/scaffolding from capabilities that are actually connected at runtime.

## Runtime gates

| Capability | Required for production | Current state |
|---|---:|---|
| PostgreSQL runtime persistence | Yes | Migration/runtime adapter required |
| Object storage runtime uploads | Yes | S3/R2 adapter exists; upload path still needs wiring |
| Private signed media | Yes | Required before public media exposure is removed |
| Redis distributed coordination | Yes | Queue infrastructure exists; request limiter/runtime consumers need wiring |
| Media processing pipeline | Yes | Worker exists; upload lifecycle must enqueue jobs |
| Document/OCR pipeline | Yes for document features | Worker boundary required and provider integration needed |
| Vector similarity search | Yes for semantic search | pgvector schema/query layer required |
| LLM assistant | Optional provider | API integration exists; key/model required |
| Google import | Optional integration | OAuth foundation exists; importer job required |
| Apple Photos import | Optional integration | Provider-specific supported API/credential path required; never simulate import |
| Calendar | Optional integration | OAuth/API connector required |
| Email | Optional integration | Resend configuration required |
| Notifications | Optional integration | Durable notification worker/provider required |
| Realtime WebSocket | Yes for realtime clients | Token endpoint exists; production WS event service required |
| Backups | Yes | Backup/restore tooling exists; scheduler and off-site target required |
| Observability | Yes | Structured logs/metrics exist; external exporter/alerts required |
| Multi-instance | Yes | Shared PostgreSQL + object storage + Redis required |
| Mobile app | Product scope | Boundary/scaffold is not a finished native client |
| Desktop app | Product scope | Desktop client still needs implementation |

## Definition of done

A production capability is marked connected only after:

1. Configuration is present.
2. Runtime code uses the provider rather than a local fallback.
3. Health/readiness verifies reachability.
4. An integration test exercises the path.
5. Failure/retry behavior is defined.
6. Data ownership and deletion behavior are covered.

## Priority order

1. PostgreSQL runtime adapter and migrations.
2. S3/R2 upload + signed private media.
3. Redis queue integration for media/document/AI/notification jobs.
4. pgvector semantic search.
5. Realtime event service.
6. Backup scheduler + restore drill against production data stores.
7. Security/privacy hardening and E2E coverage.
8. Provider integrations and native clients.
