-- Chipping in: several givers each cover part of a pricey gift. Never shown to the list owner.
CREATE TABLE IF NOT EXISTS contributions (
  id            TEXT PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  giver_token   TEXT NOT NULL,
  giver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  giver_name    TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  note          TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS contributions_item ON contributions(item_id);
CREATE INDEX IF NOT EXISTS contributions_giver_user ON contributions(giver_user_id);
CREATE INDEX IF NOT EXISTS contributions_giver_token ON contributions(giver_token);
-- A note only the giver sees ("ordered, arrives the 12th"), and the last step: wrapped.
ALTER TABLE claims ADD COLUMN note TEXT;
ALTER TABLE claims ADD COLUMN wrapped INTEGER NOT NULL DEFAULT 0;
