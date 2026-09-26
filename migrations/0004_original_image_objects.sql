-- Existing originals remain readable from image_original_chunks. New originals use R2.
ALTER TABLE image_originals ADD COLUMN object_key TEXT;
CREATE UNIQUE INDEX image_original_object_key_idx ON image_originals(object_key) WHERE object_key IS NOT NULL;
