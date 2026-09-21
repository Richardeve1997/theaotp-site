-- aotp-funnel (Cloudflare D1): the web half of the Instagram -> kit page -> email funnel.
-- The Instagram half (comment, follow gate, DM, link click) lives in Zernio's automation
-- logs and is joined at report time by bin/funnel_report.py in content-intelligence.
--
-- Apply:  npx wrangler d1 execute aotp-funnel --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS events (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    TEXT NOT NULL,   -- ISO 8601 UTC
  vid   TEXT NOT NULL,   -- anonymous browser id minted by /f.js
  type  TEXT NOT NULL,   -- visit | unlock | email | click | scroll | time
  page  TEXT,            -- kit page path, e.g. /fix/
  src   TEXT,            -- campaign code from ?s= (one code per Zernio rule, so per Reel)
  token TEXT,            -- per-person link token from ?t= (reserved: needs our own DM sender)
  label TEXT,            -- click target, scroll depth, seconds engaged, new|returning
  meta  TEXT             -- JSON: referrer, query string, returning visitor
);
CREATE INDEX IF NOT EXISTS events_src_type ON events (src, type);
CREATE INDEX IF NOT EXISTS events_vid ON events (vid);
CREATE INDEX IF NOT EXISTS events_ts ON events (ts);

CREATE TABLE IF NOT EXISTS visitors (
  vid        TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  email      TEXT,       -- set when the gate form succeeds; never sent back to a browser
  email_ts   TEXT,
  first_src  TEXT,
  first_page TEXT,
  last_src   TEXT
);
CREATE INDEX IF NOT EXISTS visitors_email ON visitors (email);
