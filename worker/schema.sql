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

-- The AOTP list, kept by us since 2026-10-10 (Rich: "switch to collecting the emails ourselves and
-- using resend to eventually send emails"). Shaped like Flywheel's subscribers and consent_records
-- (Flywheel ADR 0008) so it moves across in one import when Flywheel's Resend sending goes live.
-- Old Buttondown subscribers come in through content-intelligence bin/list_import_buttondown.py.
CREATE TABLE IF NOT EXISTS subscribers (
  email           TEXT PRIMARY KEY,   -- trimmed, lower case
  status          TEXT NOT NULL,      -- subscribed | pending | unsubscribed | suppressed (see worker.js)
  subscribed_at   TEXT NOT NULL,      -- first signup, ISO 8601 UTC
  last_signup_at  TEXT NOT NULL,
  unsubscribed_at TEXT,
  source          TEXT NOT NULL,      -- gate | buttondown | manual (added by hand, with its consent record)
  buttondown_type TEXT                -- the Buttondown type an imported address had
);
CREATE INDEX IF NOT EXISTS subscribers_status ON subscribers (status);

-- One row per signup, never changed: the words the visitor pressed, where and when.
CREATE TABLE IF NOT EXISTS consent_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL,
  method        TEXT NOT NULL,   -- guide_gate | homepage_form | buttondown_import | manual
  wording       TEXT,            -- the button on the live page, never taken from the request
  page          TEXT,            -- kit page path, e.g. /ai-pm/
  campaign_code TEXT,            -- ?s= from the DM link (one per Reel)
  link_token    TEXT,            -- ?t= per-person token (reserved)
  visitor_id    TEXT,            -- f.js visitor id, joins to visitors / events
  given_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS consent_records_email ON consent_records (email, given_at);
