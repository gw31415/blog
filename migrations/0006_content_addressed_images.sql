DROP INDEX image_object_key_idx;
CREATE INDEX image_object_key_idx ON images(object_key);
DROP TRIGGER queue_image_object_deletion;
CREATE TRIGGER queue_image_object_deletion AFTER DELETE ON images
WHEN NOT EXISTS(SELECT 1 FROM images WHERE object_key=OLD.object_key)
BEGIN
  INSERT OR IGNORE INTO image_deletions(object_key) VALUES(OLD.object_key);
END;
