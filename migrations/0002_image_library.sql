-- Keep original bytes forever; delivery records may be collected independently.
CREATE TABLE image_originals (
  id TEXT PRIMARY KEY NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE image_original_chunks (
  original_id TEXT NOT NULL REFERENCES image_originals(id),
  part INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  PRIMARY KEY(original_id, part)
);
ALTER TABLE images ADD COLUMN original_id TEXT REFERENCES image_originals(id);
ALTER TABLE images ADD COLUMN width INTEGER;
ALTER TABLE images ADD COLUMN height INTEGER;
INSERT INTO image_originals SELECT id, id, content_type, length(bytes), created_at FROM images;
INSERT INTO image_original_chunks SELECT id, 0, substr(bytes,1,1000000) FROM images;
INSERT INTO image_original_chunks SELECT id, 1, substr(bytes,1000001) FROM images WHERE length(bytes)>1000000;
UPDATE images SET original_id=id;
CREATE INDEX images_original_idx ON images(original_id);
CREATE TABLE post_images (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('pending','saved')),
  PRIMARY KEY(post_id,image_id)
);
CREATE INDEX post_images_image_idx ON post_images(image_id);
-- No FK to posts: deleted articles remain traceable by ID and title.
CREATE TABLE image_post_history (
  original_id TEXT NOT NULL REFERENCES image_originals(id),
  post_id TEXT NOT NULL,
  post_title TEXT NOT NULL,
  first_linked_at TEXT NOT NULL,
  last_linked_at TEXT NOT NULL,
  post_deleted_at TEXT,
  PRIMARY KEY(original_id,post_id)
);
INSERT INTO post_images
SELECT DISTINCT p.id,i.id,'saved' FROM posts p, json_tree(p.body_json) j
JOIN images i ON j.value='/images/'||i.id
WHERE j.key='src';
INSERT INTO image_post_history
SELECT i.original_id,p.id,p.title,p.created_at,p.updated_at,NULL
FROM post_images r JOIN posts p ON p.id=r.post_id JOIN images i ON i.id=r.image_id
GROUP BY i.original_id,p.id;
CREATE TRIGGER image_reference_history AFTER INSERT ON post_images BEGIN
  INSERT INTO image_post_history
  SELECT i.original_id,p.id,p.title,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL
  FROM images i JOIN posts p ON p.id=NEW.post_id WHERE i.id=NEW.image_id
  ON CONFLICT(original_id,post_id) DO UPDATE SET post_title=excluded.post_title,last_linked_at=excluded.last_linked_at,post_deleted_at=NULL;
END;
-- These triggers run in the same transaction as the article change.
CREATE TRIGGER post_images_saved AFTER UPDATE OF body_json ON posts BEGIN
  DELETE FROM post_images WHERE post_id=NEW.id;
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,i.id,'saved' FROM json_tree(NEW.body_json) j
  JOIN images i ON j.value='/images/'||i.id WHERE j.key='src';
  UPDATE image_post_history SET post_title=NEW.title WHERE post_id=NEW.id;
END;
CREATE TRIGGER post_images_created AFTER INSERT ON posts BEGIN
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,i.id,'saved' FROM json_tree(NEW.body_json) j
  JOIN images i ON j.value='/images/'||i.id WHERE j.key='src';
END;
CREATE TRIGGER post_images_deleted BEFORE DELETE ON posts BEGIN
  UPDATE image_post_history SET post_title=OLD.title,post_deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE post_id=OLD.id;
  DELETE FROM images WHERE id IN (SELECT image_id FROM post_images WHERE post_id=OLD.id)
  AND NOT EXISTS (SELECT 1 FROM post_images r WHERE r.image_id=images.id AND r.post_id<>OLD.id);
END;
CREATE TRIGGER validate_post_image_urls BEFORE UPDATE OF body_json ON posts BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_tree(NEW.body_json) j WHERE j.key='src' AND j.value LIKE '/images/%'
    AND NOT EXISTS (SELECT 1 FROM images i WHERE j.value='/images/'||i.id)
  ) THEN RAISE(ABORT, '配信用画像が見つかりません。画像をアップロードし直してください') END;
END;
