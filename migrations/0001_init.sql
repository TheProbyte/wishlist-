-- The Giver: initial schema

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  google_sub  TEXT UNIQUE,
  email       TEXT,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS lists (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  occasion       TEXT NOT NULL DEFAULT 'general',   -- birthday | christmas | wedding | baby | general | other
  occasion_date  TEXT,                              -- YYYY-MM-DD
  description    TEXT,
  share_token    TEXT UNIQUE,                       -- null = not shared
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS lists_owner ON lists(owner_id);

CREATE TABLE IF NOT EXISTS categories (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT REFERENCES users(id) ON DELETE CASCADE,  -- null = built in
  name            TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT '#a1a1aa',
  icon            TEXT NOT NULL DEFAULT '🎁',
  suggested_specs TEXT NOT NULL DEFAULT '[]',                   -- JSON array of labels
  position        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id            TEXT PRIMARY KEY,
  list_id       TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  url           TEXT,
  store         TEXT,
  title         TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT,
  price_cents   INTEGER,
  currency      TEXT,
  availability  TEXT,                -- in_stock | out_of_stock | unknown
  rank          INTEGER NOT NULL DEFAULT 0,   -- lower = more wanted
  rating        INTEGER NOT NULL DEFAULT 0,   -- 0..5 how much I want it
  quantity      INTEGER NOT NULL DEFAULT 1,
  note          TEXT,
  last_checked  INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS items_list ON items(list_id, rank);

CREATE TABLE IF NOT EXISTS item_specifics (
  id        TEXT PRIMARY KEY,
  item_id   TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  value     TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS specifics_item ON item_specifics(item_id, position);

CREATE TABLE IF NOT EXISTS price_history (
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  currency    TEXT,
  checked_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS price_history_item ON price_history(item_id, checked_at);

-- Claims are made by givers through a share link and are never shown to the list owner.
CREATE TABLE IF NOT EXISTS claims (
  id           TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  giver_token  TEXT NOT NULL,         -- random id kept in the giver's cookie
  giver_name   TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS claims_item ON claims(item_id);

-- Built-in categories
INSERT OR IGNORE INTO categories (id, owner_id, name, color, icon, suggested_specs, position) VALUES
  ('cat_clothes', NULL, 'Clothes',    '#f472b6', '👕', '["Size","Colour","Fit"]', 1),
  ('cat_shoes',   NULL, 'Shoes',      '#fb923c', '👟', '["Size","Width","Colour"]', 2),
  ('cat_tech',    NULL, 'Tech',       '#60a5fa', '🎧', '["Model","Storage","Colour"]', 3),
  ('cat_books',   NULL, 'Books',      '#a78bfa', '📚', '["Format","Edition"]', 4),
  ('cat_home',    NULL, 'Home',       '#34d399', '🛋️', '["Colour","Size","Material"]', 5),
  ('cat_beauty',  NULL, 'Beauty',     '#f9a8d4', '💄', '["Shade","Size"]', 6),
  ('cat_games',   NULL, 'Games & Toys','#facc15','🎮', '["Platform","Edition"]', 7),
  ('cat_jewelry', NULL, 'Jewellery',  '#fcd34d', '💍', '["Size","Metal","Colour"]', 8),
  ('cat_exp',     NULL, 'Experiences','#2dd4bf', '🎟️', '["Date","Location"]', 9),
  ('cat_other',   NULL, 'Other',      '#a1a1aa', '🎁', '[]', 10);
