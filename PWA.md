# PWA / offline mode

Life Replay includes a service worker and web manifest for an installable browser experience. The offline shell caches the application entry points so the Memory Atlas can open without a network connection.

Authenticated API requests still require connectivity unless a future sync queue is configured. Production media synchronization should use durable object storage and an explicit background sync strategy.
