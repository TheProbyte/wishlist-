-- How the app looks for you: a colour theme for the whole app, and an optional highlight colour.
ALTER TABLE users ADD COLUMN theme TEXT;
ALTER TABLE users ADD COLUMN highlight TEXT;
