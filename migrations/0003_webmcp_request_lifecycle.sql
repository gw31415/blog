-- Request records are in-flight guards, not permanent receipts.
-- Existing receipts become expired and are reclaimed on the next create request.
ALTER TABLE webmcp_requests ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX webmcp_requests_expiry_idx ON webmcp_requests(expires_at);
