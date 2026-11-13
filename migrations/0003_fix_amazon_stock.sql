-- Amazon items were wrongly marked sold out by an over-eager stock check. Clear it;
-- the next price/stock check (or re-adding) sets it properly.
UPDATE items SET availability = 'unknown' WHERE availability = 'out_of_stock' AND store = 'Amazon';
