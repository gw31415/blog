-- Absolute URLs exported by the blog retain references when pasted/imported again.
-- Matching a known opaque image ID conservatively protects a delivery across host changes.
DROP TRIGGER post_images_saved;
DROP TRIGGER post_images_created;
DROP TRIGGER post_images_deleted;
CREATE TRIGGER post_images_saved AFTER UPDATE OF body_json ON posts BEGIN
  DELETE FROM post_images WHERE post_id=NEW.id;
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,i.id,'saved' FROM json_tree(NEW.body_json) j
  JOIN images i ON j.value='/images/'||i.id OR j.value GLOB 'https://*/images/'||i.id OR j.value GLOB 'http://*/images/'||i.id
  WHERE j.key='src';
  UPDATE image_post_history SET post_title=NEW.title WHERE post_id=NEW.id;
END;
CREATE TRIGGER post_images_created AFTER INSERT ON posts BEGIN
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,i.id,'saved' FROM json_tree(NEW.body_json) j
  JOIN images i ON j.value='/images/'||i.id OR j.value GLOB 'https://*/images/'||i.id OR j.value GLOB 'http://*/images/'||i.id
  WHERE j.key='src';
END;
CREATE TRIGGER post_images_deleted BEFORE DELETE ON posts BEGIN
  UPDATE image_post_history SET post_title=OLD.title,post_deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE post_id=OLD.id;
  DELETE FROM images WHERE original_id IN (SELECT original_id FROM image_post_history WHERE post_id=OLD.id)
  AND NOT EXISTS (SELECT 1 FROM post_images r WHERE r.image_id=images.id AND r.post_id<>OLD.id);
END;
INSERT OR IGNORE INTO post_images
SELECT DISTINCT p.id,i.id,'saved' FROM posts p, json_tree(p.body_json) j
JOIN images i ON j.value='/images/'||i.id OR j.value GLOB 'https://*/images/'||i.id OR j.value GLOB 'http://*/images/'||i.id
WHERE j.key='src';
