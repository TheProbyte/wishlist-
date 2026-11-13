-- Accounts, the master "Everything" list, gifts on several lists, kids, photos,
-- sizes, circles and Secret Santa.

-- People
ALTER TABLE users ADD COLUMN sizes TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN birthday TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,          -- SHA-256 of the cookie token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Kids: lists a parent keeps for a child.
CREATE TABLE IF NOT EXISTS kids (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  birthday    TEXT,
  sizes       TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS kids_parent ON kids(parent_id);

-- Lists: 'master' is the Everything list (one per person or kid); kid_id marks a kid's list.
ALTER TABLE lists ADD COLUMN kind TEXT NOT NULL DEFAULT 'list';
ALTER TABLE lists ADD COLUMN kid_id TEXT REFERENCES kids(id) ON DELETE CASCADE;

-- A gift can sit on several lists. Its home (items.list_id) is now always its owner's
-- Everything list, so deleting an occasion list never deletes gifts.
CREATE TABLE IF NOT EXISTS list_items (
  list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rank        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (list_id, item_id)
);
CREATE INDEX IF NOT EXISTS list_items_item ON list_items(item_id);

INSERT OR IGNORE INTO lists (id, owner_id, name, occasion, kind)
  SELECT 'mst_' || id, id, 'Everything', 'general', 'master' FROM users;
INSERT OR IGNORE INTO list_items (list_id, item_id, rank, created_at)
  SELECT list_id, id, rank, created_at FROM items WHERE list_id NOT LIKE 'mst_%';
UPDATE items SET list_id = 'mst_' || (SELECT owner_id FROM lists WHERE lists.id = items.list_id)
  WHERE list_id NOT LIKE 'mst_%';

-- Price tracking
ALTER TABLE items ADD COLUMN prev_price_cents INTEGER;
ALTER TABLE items ADD COLUMN price_dropped_at INTEGER;

-- Claims: who (when signed in) and whether it's bought yet.
ALTER TABLE claims ADD COLUMN giver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE claims ADD COLUMN purchased INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS claims_giver_user ON claims(giver_user_id);
CREATE INDEX IF NOT EXISTS claims_giver_token ON claims(giver_token);

-- Your own photos of gifts (resized in the browser; base64 keeps D1 rows simple).
CREATE TABLE IF NOT EXISTS images (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  data        TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Circles: family and friends who can see each other's lists.
CREATE TABLE IF NOT EXISTS circles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_token  TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS circle_members (
  circle_id  TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (circle_id, user_id)
);
CREATE INDEX IF NOT EXISTS circle_members_user ON circle_members(user_id);

-- Secret Santa
CREATE TABLE IF NOT EXISTS exchanges (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_cents  INTEGER,
  currency      TEXT NOT NULL DEFAULT 'USD',
  exchange_date TEXT,
  invite_token  TEXT NOT NULL UNIQUE,
  drawn_at      INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS exchange_members (
  exchange_id   TEXT NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  joined_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (exchange_id, user_id)
);
CREATE INDEX IF NOT EXISTS exchange_members_user ON exchange_members(user_id);
