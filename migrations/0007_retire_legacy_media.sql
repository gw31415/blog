-- Apply only after the unified-media Worker is serving migrated articles.
DROP TRIGGER IF EXISTS delete_unreferenced_render_cache;
DROP TRIGGER IF EXISTS post_images_created;
DROP TRIGGER IF EXISTS post_images_saved;
DROP TABLE post_render_refs;
DROP TABLE render_cache;
DROP TABLE post_images;
DROP TABLE image_variants;
