-- One private link that shows all of a person's lists to givers.
ALTER TABLE users ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_share_token ON users(share_token);
