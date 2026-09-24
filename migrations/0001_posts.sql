CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 26),
  canonical_alias TEXT UNIQUE,
  format_version INTEGER NOT NULL DEFAULT 2 CHECK (format_version = 2),
  body_format TEXT NOT NULL DEFAULT 'tiptap-json' CHECK (body_format = 'tiptap-json'),
  content_schema_version INTEGER NOT NULL DEFAULT 1 CHECK (content_schema_version = 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  body_json TEXT NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}' CHECK (json_valid(body_json) AND json_extract(body_json, '$.type') = 'doc'),
  editing_state TEXT CHECK (editing_state IS NULL OR json_valid(editing_state)),
  CHECK (status = 'draft' OR (length(trim(title)) > 0 AND published_at IS NOT NULL))
);
CREATE TABLE post_aliases (
  alias TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX posts_published_at_idx ON posts(published_at DESC, id DESC);
CREATE INDEX post_aliases_post_id_idx ON post_aliases(post_id);
CREATE TABLE images (
  id TEXT PRIMARY KEY NOT NULL,
  content_type TEXT NOT NULL,
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS render_cache (
  key TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mermaid','inlineMath','blockMath')),
  source TEXT NOT NULL,
  renderer TEXT NOT NULL,
  output TEXT,
  diagnostic TEXT,
  owner TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  CHECK (output IS NULL OR diagnostic IS NULL)
);
CREATE TABLE IF NOT EXISTS post_render_refs (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL REFERENCES render_cache(key) ON DELETE CASCADE,
  PRIMARY KEY (post_id, cache_key)
);
CREATE INDEX IF NOT EXISTS post_render_refs_cache_key_idx ON post_render_refs(cache_key);
CREATE TRIGGER IF NOT EXISTS delete_unreferenced_render_cache
AFTER DELETE ON post_render_refs
WHEN NOT EXISTS (SELECT 1 FROM post_render_refs WHERE cache_key = OLD.cache_key)
BEGIN
  DELETE FROM render_cache WHERE key = OLD.cache_key;
END;
