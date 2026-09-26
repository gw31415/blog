-- Avoid D1 GLOB pattern length limits with extension-bearing IDs.
DROP TRIGGER post_images_saved;
DROP TRIGGER post_images_created;
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
