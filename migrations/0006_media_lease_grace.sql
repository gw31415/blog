CREATE TRIGGER media_lease_added AFTER INSERT ON media_upload_leases BEGIN
 UPDATE media_variants SET unreferenced_at=NULL WHERE id=NEW.variant_id;
END;
DROP TRIGGER media_ref_removed;
CREATE TRIGGER media_ref_removed AFTER DELETE ON post_media_refs BEGIN
 UPDATE media_variants SET unreferenced_at=CASE WHEN EXISTS(SELECT 1 FROM media_upload_leases WHERE variant_id=OLD.variant_id AND expires_at>unixepoch()) THEN NULL ELSE unixepoch() END
 WHERE id=OLD.variant_id AND NOT EXISTS(SELECT 1 FROM post_media_refs WHERE variant_id=OLD.variant_id);
END;
