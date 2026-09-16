# Life Replay — Production Gap Register

Updated: 2026-09-16

This is the implementation gate for the complete product. It deliberately separates existing foundations from work that still requires engineering or external provider configuration.

## Existing foundations

The repository already contains authentication, user-scoped memories, profiles, sessions, tags, people, locations, sharing/collaboration database foundations, comments/reactions, calendar-event storage, notifications, AI jobs, embeddings storage, replay records, audit logs, export, map/timeline/search behavior, media uploads, PWA assets, health/readiness endpoints and CI/security workflows.

## Still required

### Critical

1. Replace production SQLite with managed PostgreSQL.
2. Replace container-local media with durable object storage.
3. Add private/signed media delivery.
4. Add automated DB backups and verified restores.
5. Add durable media integrity verification.
6. Complete refresh-token rotation and replay detection.
7. Add email verification and password recovery.
8. Add distributed rate limiting.
9. Add account deletion and retention workflow.
10. Add disaster-recovery runbook and recovery drill.

### Media

11. Resumable/chunked uploads.
12. Background media jobs.
13. EXIF extraction with privacy controls.
14. Thumbnail and responsive image generation.
15. Video transcoding.
16. Audio transcription.
17. Malware/content scanning.
18. Near-duplicate detection.
19. Storage lifecycle cleanup.

### Intelligence

20. Production AI provider abstraction.
21. Real embeddings generation.
22. Vector/semantic search.
23. Hybrid search.
24. AI captions/summaries.
25. Person/place/topic extraction.
26. Memory clustering.
27. Year/month reports.
28. Life-chapter generation.
29. Strict AI retrieval isolation and prompt/data protections.
30. AI usage/cost controls.

### Replay

31. Day/week/month/year/custom replay generation.
32. Automatic highlight selection.
33. Narration and optional music.
34. Replay editing.
35. Replay export.
36. Replay sharing.
37. Replay generation progress/retry.

### Discovery

38. Calendar view.
39. Advanced search and saved searches.
40. Similar memories.
41. Duplicate clusters.
42. People profiles.
43. Place profiles.
44. Life Graph.

### Integrations

45. Google Photos OAuth/import.
46. Apple Photos integration where supported.
47. Calendar authorization/synchronization.
48. Generic archive import/export.
49. Provider disconnect/revoke lifecycle.

### Collaboration

50. Complete invitation lifecycle.
51. Granular viewer/editor permissions.
52. Share permission management UI.
53. Expiring/password-protected links.
54. Link revocation UI.
55. QR share cards.
56. Comment/reaction UI.
57. Collaboration activity history.

### Mobile

58. Offline timeline.
59. Offline drafts.
60. Background upload.
61. Network-aware retries.
62. Camera capture workflow.
63. Push notifications.
64. Native packaging if required.

### Operations

65. Structured logs/correlation IDs.
66. Error tracking.
67. Metrics and dashboards.
68. Alerts.
69. Background-job monitoring.
70. Capacity/load tests.
71. Security/authorization regression suite.
72. Browser/mobile E2E CI.
73. Accessibility CI.

### Privacy/accessibility

74. Privacy Center.
75. AI consent controls.
76. Connected-app management.
77. Shared-link audit.
78. Data deletion controls.
79. Keyboard/screen-reader support.
80. Reduced-motion and contrast support.
81. Localization/timezone/RTL readiness.

## External dependencies

Some items cannot be truthfully marked operational without external credentials or infrastructure: managed PostgreSQL, object storage, email delivery, push delivery, Google Photos, Apple Photos, calendar providers and a production AI provider. The application can be prepared for these integrations without pretending they work before credentials and end-to-end tests exist.

## Release gate

Do not call the service a durable lifetime-memory backup until all Critical items are complete and restore verification succeeds. Do not call AI semantic search production-ready until embeddings, retrieval isolation, provider failure handling and AI cost controls are tested.
