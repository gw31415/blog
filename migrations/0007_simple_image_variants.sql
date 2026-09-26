-- Pre-deployment breaking replacement. Article content is retained.
DROP TRIGGER image_reference_history;
DROP TRIGGER post_images_saved;
DROP TRIGGER post_images_created;
DROP TRIGGER post_images_deleted;
DROP TRIGGER validate_post_image_urls;
DROP TRIGGER queue_image_object_deletion;
DROP TABLE post_images;
DROP TABLE image_post_history;
DROP TABLE images;
DROP TABLE image_originals;
DROP TABLE image_deletions;
CREATE TABLE image_variants (
  id TEXT PRIMARY KEY NOT NULL,
  original_id TEXT NOT NULL,
  width INTEGER NOT NULL CHECK(width>0),
  height INTEGER NOT NULL CHECK(height>0)
);
CREATE INDEX image_variants_original_idx ON image_variants(original_id);
CREATE TABLE post_images (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES image_variants(id),
  PRIMARY KEY(post_id,variant_id)
);
CREATE INDEX post_images_variant_idx ON post_images(variant_id);
CREATE TRIGGER post_images_saved AFTER UPDATE OF body_json ON posts BEGIN
  DELETE FROM post_images WHERE post_id=NEW.id;
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,v.id FROM json_tree(NEW.body_json) j
  JOIN image_variants v ON j.value='/images/variants/'||v.id OR ((substr(j.value,1,8)='https://' OR substr(j.value,1,7)='http://') AND substr(j.value,-(17+length(v.id)))='/images/variants/'||v.id)
  WHERE j.key='src';
END;
CREATE TRIGGER post_images_created AFTER INSERT ON posts BEGIN
  INSERT INTO post_images
  SELECT DISTINCT NEW.id,v.id FROM json_tree(NEW.body_json) j
  JOIN image_variants v ON j.value='/images/variants/'||v.id OR ((substr(j.value,1,8)='https://' OR substr(j.value,1,7)='http://') AND substr(j.value,-(17+length(v.id)))='/images/variants/'||v.id)
  WHERE j.key='src';
END;
