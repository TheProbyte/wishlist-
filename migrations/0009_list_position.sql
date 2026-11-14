-- Lists can be arranged by hand on the shelf. NULL: not placed yet (shown first, soonest first).
ALTER TABLE lists ADD COLUMN position INTEGER;
