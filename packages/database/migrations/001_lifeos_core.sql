-- LifeOS PostgreSQL baseline. Kept separate from the legacy SQLite runtime until the repository/service migration is complete.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS lifeos_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifeos_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES lifeos_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  caption text NOT NULL DEFAULT '',
  place text NOT NULL DEFAULT '',
  occurred_on date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifeos_memories_user_date ON lifeos_memories(user_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS lifeos_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES lifeos_memories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lifeos_users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  checksum text NOT NULL,
  scan_status text NOT NULL DEFAULT 'pending',
  processing_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifeos_media_user ON lifeos_media(user_id);
CREATE INDEX IF NOT EXISTS idx_lifeos_media_checksum ON lifeos_media(user_id, checksum);

CREATE TABLE IF NOT EXISTS lifeos_embeddings (
  memory_id uuid PRIMARY KEY REFERENCES lifeos_memories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lifeos_users(id) ON DELETE CASCADE,
  embedding jsonb,
  embedding_model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
