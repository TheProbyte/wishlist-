-- Notifications: each browser that said yes, the app's own signing key, and what's been sent
-- (so each reminder goes once).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS app_keys (
  name  TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS push_sent (
  user_id TEXT NOT NULL,
  kind    TEXT NOT NULL,
  ref     TEXT NOT NULL,
  sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, kind, ref)
);
