-- Pre-deployment breaking reset of image records. Article text is retained.
DELETE FROM images;
DELETE FROM image_post_history;
DROP TABLE image_original_chunks;
DELETE FROM image_originals;
ALTER TABLE images DROP COLUMN bytes;
ALTER TABLE images ADD COLUMN object_key TEXT NOT NULL DEFAULT '' CHECK(length(object_key)>0);
CREATE UNIQUE INDEX image_object_key_idx ON images(object_key);
CREATE TABLE image_deletions (object_key TEXT PRIMARY KEY NOT NULL);
CREATE TRIGGER queue_image_object_deletion AFTER DELETE ON images BEGIN
  INSERT OR IGNORE INTO image_deletions(object_key) VALUES(OLD.object_key);
END;
