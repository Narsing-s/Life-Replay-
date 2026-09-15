# Life Replay — Known Limitations

Updated: 2026-09-16

These are intentional engineering limitations, not hidden failures.

## Current deployment storage

The SnapDeploy test deployment uses SQLite and container-local media. This is suitable for functional testing but is not durable enough for irreplaceable personal memories. A container restart/replacement can lose local state.

## External photo providers

Google Photos and Apple Photos require provider-specific authorization/configuration. A `GOOGLE_CLIENT_ID` environment variable alone does not implement a complete Google Photos import workflow.

## AI

The current `/api/v1/ai/ask` endpoint provides authenticated timeline search/answer behavior. It is not yet a production LLM/vector-search system.

## Voice

Voice-to-memory depends on browser Speech Recognition support and permissions. Unsupported browsers must fall back to manual entry.

## Media

Uploads have MIME and size validation and v1 checksum detection, but production media processing still needs durable object storage, thumbnails, transcoding, malware scanning and signed URLs.

## Collaboration

Database foundations exist for sharing/collaboration/comments/reactions, but the complete production UI and permission lifecycle still need implementation and E2E testing.

## Production requirement

These limitations should be resolved before storing irreplaceable memories or advertising unlimited durable storage.
