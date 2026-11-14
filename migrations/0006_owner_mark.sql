-- A private random marker per account, kept in a long-lived cookie on every device the owner has
-- signed in on (even after signing out), so their own share links keep claims hidden there.
ALTER TABLE users ADD COLUMN owner_mark TEXT;
