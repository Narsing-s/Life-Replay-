CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  mime_type TEXT NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_memory ON documents(memory_id);
