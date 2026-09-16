# LifeOS Runtime Data Plane

```text
Clients
  |
  v
API/BFF
  |-- Identity/Auth
  |-- Life/Memory
  |-- AI Orchestrator
  |-- Documents/OCR
  |-- Search
  |-- WebSocket
  |
  +--> PostgreSQL + pgvector
  +--> S3/R2 private objects
  +--> Redis/BullMQ
             |
             +--> media worker
             +--> document/OCR worker
             +--> AI/embedding worker
             +--> notification worker
  |
  +--> integrations
       Google / Calendar / Drive / Email / future providers
```

## Data ownership

Every user-owned object is scoped by `user_id`. Media is referenced by an object-storage key, not by a machine-local absolute path. Provider credentials are encrypted at rest and never returned to clients.

## Asynchronous lifecycle

### Media

`upload -> validate -> quarantine/scan -> object storage -> metadata -> thumbnail/transcode -> ready`

A failed scan or processing step must not make an unsafe object available to the user. Jobs must be retryable and idempotent.

### AI

`memory/document -> normalized text -> embedding job -> pgvector -> retrieval -> LLM orchestration`

AI responses must only use data authorized for the authenticated user.

### Import

`OAuth -> encrypted credential -> import job -> provider pagination -> dedupe -> memory/document creation -> audit`

An import UI must report `not connected`, `connected`, `running`, `completed`, or `failed`; it must never report imported content without successful provider API operations.

## Runtime readiness

Production readiness requires PostgreSQL, Redis and S3/R2 to be both configured and reachable. Provider configuration alone is not sufficient.
