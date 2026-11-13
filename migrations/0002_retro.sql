-- Retro redesign: wrapping paper per list, line icons instead of emoji, palette colours.

ALTER TABLE lists ADD COLUMN wrap TEXT;

UPDATE categories SET icon = CASE icon
  WHEN '🎁' THEN 'gift' WHEN '👕' THEN 'shirt' WHEN '👟' THEN 'shoe' WHEN '🎧' THEN 'headphones'
  WHEN '📚' THEN 'book' WHEN '🛋️' THEN 'sofa' WHEN '💄' THEN 'lipstick' WHEN '🎮' THEN 'gamepad'
  WHEN '💍' THEN 'ring' WHEN '🎟️' THEN 'ticket' WHEN '🍳' THEN 'pan' WHEN '🌿' THEN 'leaf'
  WHEN '🧸' THEN 'teddy' WHEN '🏕️' THEN 'tent' WHEN '🎨' THEN 'palette' WHEN '🐶' THEN 'paw'
  WHEN '⚽' THEN 'ball' WHEN '🍷' THEN 'wine' WHEN '✈️' THEN 'plane' WHEN '💻' THEN 'laptop'
  ELSE icon END;

UPDATE categories SET color = CASE id
  WHEN 'cat_clothes' THEN '#EC9468' WHEN 'cat_shoes' THEN '#E8A83A' WHEN 'cat_tech' THEN '#7CC2BA'
  WHEN 'cat_books' THEN '#F3E7CF' WHEN 'cat_home' THEN '#7CC2BA' WHEN 'cat_beauty' THEN '#EC9468'
  WHEN 'cat_games' THEN '#E8A83A' WHEN 'cat_jewelry' THEN '#E8A83A' WHEN 'cat_exp' THEN '#7CC2BA'
  WHEN 'cat_other' THEN '#C9B79A' ELSE color END
WHERE owner_id IS NULL;
