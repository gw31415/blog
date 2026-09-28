-- Preserve the last article title/link when an article is deleted.
CREATE TRIGGER media_article_deleted BEFORE DELETE ON posts BEGIN
 UPDATE image_article_history SET post_title_snapshot=OLD.title,last_unlinked_at=unixepoch() WHERE post_id_snapshot=OLD.id;
END;
