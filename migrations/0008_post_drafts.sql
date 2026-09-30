-- Keep existing public rows untouched. Draft writes never update published content.
CREATE TABLE post_drafts (
  id TEXT PRIMARY KEY NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  canonical_alias TEXT UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  tags TEXT NOT NULL CHECK(json_valid(tags) AND json_type(tags)='array'),
  body_json TEXT NOT NULL CHECK(json_valid(body_json) AND json_extract(body_json,'$.type')='doc'),
  published_at TEXT,
  updated_at TEXT NOT NULL,
  save_token TEXT NOT NULL
);
CREATE VIEW editable_posts AS SELECT
 p.id,p.status,p.format_version,p.body_format,p.content_schema_version,p.created_at,
 CASE WHEN d.id IS NULL THEN p.canonical_alias ELSE d.canonical_alias END AS canonical_alias,
 CASE WHEN d.id IS NULL THEN p.title ELSE d.title END AS title,
 CASE WHEN d.id IS NULL THEN p.subtitle ELSE d.subtitle END AS subtitle,
 CASE WHEN d.id IS NULL THEN p.description ELSE d.description END AS description,
 CASE WHEN d.id IS NULL THEN p.tags ELSE d.tags END AS tags,
 CASE WHEN d.id IS NULL THEN p.body_json ELSE d.body_json END AS body_json,
 CASE WHEN d.id IS NULL THEN p.published_at ELSE d.published_at END AS published_at,
 COALESCE(d.updated_at,p.updated_at) AS updated_at,
 CASE WHEN d.id IS NULL THEN p.editing_state ELSE NULL END AS editing_state,
 d.id IS NOT NULL AS has_draft
 FROM posts p LEFT JOIN post_drafts d ON d.id=p.id;
CREATE TABLE post_draft_media_refs(
 post_id TEXT NOT NULL REFERENCES post_drafts(id) ON DELETE CASCADE,node_path TEXT NOT NULL,
 body_hash TEXT NOT NULL,variant_id TEXT REFERENCES media_variants(id),render_key TEXT,
 embed_initial INTEGER NOT NULL CHECK(embed_initial IN (0,1)),policy_version TEXT NOT NULL,
 diagnostic TEXT,PRIMARY KEY(post_id,node_path)
);
CREATE INDEX draft_media_ref_variant ON post_draft_media_refs(variant_id);
CREATE VIEW all_post_media_refs AS SELECT * FROM post_media_refs UNION ALL SELECT * FROM post_draft_media_refs;
CREATE TRIGGER draft_media_ref_ready BEFORE INSERT ON post_draft_media_refs WHEN NEW.variant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media_variants WHERE id=NEW.variant_id AND state='ready') BEGIN SELECT RAISE(ABORT,'Media is not ready'); END;
CREATE TRIGGER draft_media_ref_added AFTER INSERT ON post_draft_media_refs BEGIN UPDATE media_variants SET unreferenced_at=NULL WHERE id=NEW.variant_id; END;
CREATE TRIGGER draft_media_ref_removed AFTER DELETE ON post_draft_media_refs BEGIN
 UPDATE media_variants SET unreferenced_at=CASE WHEN EXISTS(SELECT 1 FROM media_upload_leases WHERE variant_id=OLD.variant_id AND expires_at>unixepoch()) THEN NULL ELSE unixepoch() END
 WHERE id=OLD.variant_id AND NOT EXISTS(SELECT 1 FROM all_post_media_refs WHERE variant_id=OLD.variant_id);
END;
DROP TRIGGER media_ref_removed;
CREATE TRIGGER media_ref_removed AFTER DELETE ON post_media_refs BEGIN
 UPDATE media_variants SET unreferenced_at=CASE WHEN EXISTS(SELECT 1 FROM media_upload_leases WHERE variant_id=OLD.variant_id AND expires_at>unixepoch()) THEN NULL ELSE unixepoch() END
 WHERE id=OLD.variant_id AND NOT EXISTS(SELECT 1 FROM all_post_media_refs WHERE variant_id=OLD.variant_id);
END;
