-- Additive: old tables remain readable while the live Worker is upgraded.
CREATE TABLE image_originals(id TEXT PRIMARY KEY,object_key TEXT NOT NULL UNIQUE,mime TEXT,byte_length INTEGER,created_at INTEGER);
CREATE TABLE media_variants(
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('raster','mermaid','inlineMath','blockMath')),
 original_id TEXT REFERENCES image_originals(id),render_key TEXT,recipe TEXT NOT NULL,
 object_key TEXT UNIQUE NOT NULL,content_hash TEXT NOT NULL,mime TEXT NOT NULL,
 width REAL NOT NULL CHECK(width>0),height REAL NOT NULL CHECK(height>0),layout_json TEXT NOT NULL DEFAULT '{}',
 state TEXT NOT NULL CHECK(state IN ('uploading','ready','deleting')),created_at INTEGER NOT NULL,
 unreferenced_at INTEGER,upload_expires_at INTEGER,
 CHECK((kind='raster' AND original_id IS NOT NULL) OR (kind<>'raster' AND render_key IS NOT NULL))
);
CREATE UNIQUE INDEX media_render_ready ON media_variants(render_key) WHERE state='ready' AND render_key IS NOT NULL;
CREATE INDEX media_original ON media_variants(original_id);
CREATE INDEX media_gc ON media_variants(state,unreferenced_at);
CREATE TABLE post_media_refs(
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,node_path TEXT NOT NULL,
 body_hash TEXT NOT NULL,variant_id TEXT REFERENCES media_variants(id),render_key TEXT,
 embed_initial INTEGER NOT NULL CHECK(embed_initial IN (0,1)),policy_version TEXT NOT NULL,
 diagnostic TEXT,PRIMARY KEY(post_id,node_path)
);
CREATE INDEX media_ref_variant ON post_media_refs(variant_id);
CREATE INDEX media_ref_fold ON post_media_refs(post_id,embed_initial);
CREATE TABLE media_upload_leases(token TEXT PRIMARY KEY,variant_id TEXT NOT NULL REFERENCES media_variants(id),post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX media_lease_variant ON media_upload_leases(variant_id,expires_at);
CREATE INDEX media_lease_expiry ON media_upload_leases(expires_at);
CREATE TABLE image_article_history(original_id TEXT NOT NULL REFERENCES image_originals(id),post_id_snapshot TEXT NOT NULL,post_title_snapshot TEXT NOT NULL,first_linked_at INTEGER NOT NULL,last_linked_at INTEGER NOT NULL,last_unlinked_at INTEGER,PRIMARY KEY(original_id,post_id_snapshot));
CREATE TRIGGER media_ref_ready BEFORE INSERT ON post_media_refs WHEN NEW.variant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media_variants WHERE id=NEW.variant_id AND state='ready') BEGIN SELECT RAISE(ABORT,'Media is not ready'); END;
CREATE TRIGGER media_lease_ready BEFORE INSERT ON media_upload_leases WHEN NOT EXISTS(SELECT 1 FROM media_variants WHERE id=NEW.variant_id AND state IN ('ready','uploading')) BEGIN SELECT RAISE(ABORT,'Media is deleting'); END;
CREATE TRIGGER media_ref_removed AFTER DELETE ON post_media_refs BEGIN UPDATE media_variants SET unreferenced_at=unixepoch() WHERE id=OLD.variant_id AND NOT EXISTS(SELECT 1 FROM post_media_refs WHERE variant_id=OLD.variant_id); END;
CREATE TRIGGER media_ref_added AFTER INSERT ON post_media_refs BEGIN UPDATE media_variants SET unreferenced_at=NULL WHERE id=NEW.variant_id; END;
INSERT INTO image_originals(id,object_key) SELECT DISTINCT original_id,'images/originals/'||original_id FROM image_variants;
INSERT INTO media_variants(id,kind,original_id,recipe,object_key,content_hash,mime,width,height,state,created_at,unreferenced_at)
 SELECT id,'raster',original_id,'avif:legacy','images/variants/'||id,'legacy','image/avif',width,height,'ready',unixepoch(),unixepoch() FROM image_variants;
