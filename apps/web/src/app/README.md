# Web application

Feature boundaries for auth, dashboard, assistant, documents, memories, tasks, search and settings live under `src/features`.

The existing browser UI remains the active client. New service boundaries should consume the shared API contract instead of embedding provider-specific credentials in the browser.
