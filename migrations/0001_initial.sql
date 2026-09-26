-- Initial schema for a fresh D1 database. Contains no article or image data.

CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 26),
  canonical_alias TEXT UNIQUE,
  format_version INTEGER NOT NULL DEFAULT 1 CHECK (format_version = 1),
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

CREATE TABLE image_variants (
  id TEXT PRIMARY KEY NOT NULL,
  original_id TEXT NOT NULL,
  width INTEGER NOT NULL CHECK(width>0),
  height INTEGER NOT NULL CHECK(height>0)
);

CREATE TABLE post_images (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES image_variants(id),
  PRIMARY KEY(post_id,variant_id)
);

CREATE TABLE render_cache (
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

CREATE TABLE post_render_refs (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL REFERENCES render_cache(key) ON DELETE CASCADE,
  PRIMARY KEY (post_id, cache_key)
);

CREATE INDEX image_variants_original_idx ON image_variants(original_id);

CREATE INDEX post_images_variant_idx ON post_images(variant_id);

CREATE INDEX post_render_refs_cache_key_idx ON post_render_refs(cache_key);

CREATE INDEX posts_published_at_idx ON posts(published_at DESC, id DESC);

CREATE TRIGGER delete_unreferenced_render_cache
AFTER DELETE ON post_render_refs
WHEN NOT EXISTS (SELECT 1 FROM post_render_refs WHERE cache_key = OLD.cache_key)
BEGIN
  DELETE FROM render_cache WHERE key = OLD.cache_key;
END;

CREATE TRIGGER post_images_created AFTER INSERT ON posts BEGIN
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,v.id FROM json_tree(NEW.body_json) j
  JOIN image_variants v ON j.value='/images/variants/'||v.id OR ((substr(j.value,1,8)='https://' OR substr(j.value,1,7)='http://') AND substr(j.value,-(17+length(v.id)))='/images/variants/'||v.id)
  WHERE j.key='src';
END;

CREATE TRIGGER post_images_saved AFTER UPDATE OF body_json ON posts BEGIN
  DELETE FROM post_images WHERE post_id=NEW.id;
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,v.id FROM json_tree(NEW.body_json) j
  JOIN image_variants v ON j.value='/images/variants/'||v.id OR ((substr(j.value,1,8)='https://' OR substr(j.value,1,7)='http://') AND substr(j.value,-(17+length(v.id)))='/images/variants/'||v.id)
  WHERE j.key='src';
END;
