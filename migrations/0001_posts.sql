CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 26),
  canonical_alias TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_aliases (
  alias TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX posts_published_at_idx ON posts(published_at DESC, id DESC);
CREATE INDEX post_aliases_post_id_idx ON post_aliases(post_id);
