-- Compatibility migration for databases created before the durable import schema.
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS processed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS imported_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_import_jobs_status_updated ON import_jobs(status,updated_at);

ALTER TABLE replays ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready';
