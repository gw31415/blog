-- Persist request receipts after deletion so retries cannot recreate removed drafts.
CREATE TABLE webmcp_requests (
  request_id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL
);
