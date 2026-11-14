-- Secret Santa: pairs who shouldn't draw each other, and when each person first opened their slip.
CREATE TABLE IF NOT EXISTS exchange_apart (
  exchange_id TEXT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  a           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (exchange_id, a, b)
);
ALTER TABLE exchange_members ADD COLUMN seen_at INTEGER;
