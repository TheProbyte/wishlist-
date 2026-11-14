import { waitUntil } from 'cloudflare:workers';
import { importProduct } from './importer';
import { notify } from './push.ts';
import { formatPrice } from '#lib/format.ts';
import type { Item } from '#lib/types.ts';

/**
 * Price and stock tracking, done lazily: when a list is opened, a few gifts that haven't been
 * checked for a day are re-read from their shop in the background (after the page is sent).
 * A lower price marks a price drop; the old price is kept to show what it was.
 */
const STALE_AFTER = 20 * 3600; // seconds
const PER_VIEW = 4;

export function refreshStale(db: D1Database, items: Pick<Item, 'id' | 'url' | 'last_checked' | 'price_cents' | 'prev_price_cents'>[]) {
	const now = Math.floor(Date.now() / 1000);
	const stale = items.filter((i) => i.url && (!i.last_checked || now - i.last_checked > STALE_AFTER)).slice(0, PER_VIEW);
	if (!stale.length) return;
	// Mark them checked straight away so several viewers don't all re-check the same gifts.
	const work = db
		.batch(stale.map((i) => db.prepare('UPDATE items SET last_checked = ? WHERE id = ?').bind(now, i.id)))
		.then(() => Promise.allSettled(stale.map((i) => refreshOne(db, i, now))));
	try {
		waitUntil(work);
	} catch {
		/* not on Workers (tests): let it run */
	}
}

async function refreshOne(db: D1Database, item: Pick<Item, 'id' | 'url' | 'price_cents'>, now: number) {
	const r = await importProduct(item.url!);
	if (r.blocked || (r.price_cents == null && r.availability === 'unknown')) return;
	const statements: D1PreparedStatement[] = [];
	if (r.availability !== 'unknown') statements.push(db.prepare('UPDATE items SET availability = ? WHERE id = ?').bind(r.availability, item.id));
	if (r.price_cents != null && r.price_cents !== item.price_cents) {
		const dropped = item.price_cents != null && r.price_cents < item.price_cents;
		statements.push(
			dropped
				? db.prepare('UPDATE items SET prev_price_cents = ?, price_cents = ?, price_dropped_at = ? WHERE id = ?').bind(item.price_cents, r.price_cents, now, item.id)
				: db.prepare('UPDATE items SET price_cents = ?, prev_price_cents = NULL, price_dropped_at = NULL WHERE id = ?').bind(r.price_cents, item.id),
			db.prepare('INSERT INTO price_history (item_id, price_cents, currency) VALUES (?, ?, ?)').bind(item.id, r.price_cents, r.currency)
		);
	}
	if (statements.length) await db.batch(statements);
	// A lower price on one of your own gifts: let you know (once per new price).
	if (r.price_cents != null && item.price_cents != null && r.price_cents < item.price_cents) {
		const own = await db.prepare('SELECT i.title, i.currency, l.owner_id, l.id AS list_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ?').bind(item.id).first<{ title: string; currency: string | null; owner_id: string; list_id: string }>();
		if (own)
			await notify(
				db,
				own.owner_id,
				{
					title: `Price drop: ${own.title.length > 40 ? `${own.title.slice(0, 38)}…` : own.title}`,
					body: `Now ${formatPrice(r.price_cents, own.currency)} (was ${formatPrice(item.price_cents, own.currency)}).`,
					url: `/lists/${own.list_id}`,
					tag: `drop-${item.id}`
				},
				{ kind: 'drop', ref: `${item.id}|${r.price_cents}` }
			);
	}
}
