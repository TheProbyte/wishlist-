import { newId } from './db';
import type { ItemInput } from './items';

/**
 * Gift operations shared by every place gifts are added or changed.
 *
 * A gift lives in its owner's Everything list (`master`) and can also sit on any of that
 * owner's occasion lists (list_items). Claims belong to the gift, so a gift claimed on one
 * list shows as taken everywhere it appears.
 */

/** The occasion lists a gift may be put on: this owner's (or kid's) own lists. */
export async function allowedLists(db: D1Database, master: string): Promise<Set<string>> {
	const owner = await db.prepare('SELECT owner_id, kid_id FROM lists WHERE id = ?').bind(master).first<{ owner_id: string; kid_id: string | null }>();
	if (!owner) return new Set();
	const { results } = owner.kid_id
		? await db.prepare("SELECT id FROM lists WHERE kid_id = ? AND kind = 'list'").bind(owner.kid_id).all<{ id: string }>()
		: await db.prepare("SELECT id FROM lists WHERE owner_id = ? AND kid_id IS NULL AND kind = 'list'").bind(owner.owner_id).all<{ id: string }>();
	return new Set(results.map((r) => r.id));
}

export async function giftIn(db: D1Database, master: string, itemId: string) {
	return db.prepare('SELECT id, price_cents FROM items WHERE id = ? AND list_id = ?').bind(itemId, master).first<{ id: string; price_cents: number | null }>();
}

/** Create or update a gift and put it on exactly the lists asked for. Returns its id. */
export async function saveGift(db: D1Database, master: string, item: ItemInput): Promise<string | { error: string }> {
	const allowed = await allowedLists(db, master);
	const lists = item.lists.filter((l) => allowed.has(l));
	const statements: D1PreparedStatement[] = [];
	let id = item.id;

	if (id) {
		const existing = await giftIn(db, master, id);
		if (!existing) return { error: 'That gift no longer exists.' };
		statements.push(
			db
				.prepare(
					`UPDATE items SET url = ?, title = ?, image_url = ?, price_cents = ?, currency = ?, store = ?, category_id = ?,
					 rating = ?, quantity = ?, note = ?, description = ?, availability = COALESCE(?, availability), updated_at = unixepoch()
					 WHERE id = ?`
				)
				.bind(item.url, item.title, item.image_url, item.price_cents, item.currency, item.store, item.category_id, item.rating, item.quantity, item.note, item.description, item.availability, id)
		);
		if (item.price_cents != null && item.price_cents !== existing.price_cents)
			statements.push(db.prepare('INSERT INTO price_history (item_id, price_cents, currency) VALUES (?, ?, ?)').bind(id, item.price_cents, item.currency));
	} else {
		id = newId('itm');
		const max = await db.prepare('SELECT COALESCE(MAX(rank), -1) AS r FROM items WHERE list_id = ?').bind(master).first<{ r: number }>();
		statements.push(
			db
				.prepare(
					`INSERT INTO items (id, list_id, url, title, image_url, price_cents, currency, store, category_id, rating, quantity, note, description, availability, rank, last_checked)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(id, master, item.url, item.title, item.image_url, item.price_cents, item.currency, item.store, item.category_id, item.rating, item.quantity, item.note, item.description, item.availability ?? 'unknown', (max?.r ?? -1) + 1, item.url ? Math.floor(Date.now() / 1000) : null)
		);
		if (item.price_cents != null)
			statements.push(db.prepare('INSERT INTO price_history (item_id, price_cents, currency) VALUES (?, ?, ?)').bind(id, item.price_cents, item.currency));
	}

	statements.push(db.prepare('DELETE FROM item_specifics WHERE item_id = ?').bind(id));
	item.specifics.forEach((s, i) =>
		statements.push(db.prepare('INSERT INTO item_specifics (id, item_id, label, value, position) VALUES (?, ?, ?, ?, ?)').bind(newId('spc'), id, s.label, s.value, i))
	);

	// Lists: drop the ones unticked, add the new ones at the bottom.
	const placeholders = lists.map(() => '?').join(',');
	statements.push(
		lists.length
			? db.prepare(`DELETE FROM list_items WHERE item_id = ? AND list_id NOT IN (${placeholders})`).bind(id, ...lists)
			: db.prepare('DELETE FROM list_items WHERE item_id = ?').bind(id)
	);
	for (const l of lists) {
		statements.push(
			db
				.prepare('INSERT OR IGNORE INTO list_items (list_id, item_id, rank) VALUES (?, ?, (SELECT COALESCE(MAX(rank), -1) + 1 FROM list_items WHERE list_id = ?))')
				.bind(l, id, l)
		);
		statements.push(db.prepare('UPDATE lists SET updated_at = unixepoch() WHERE id = ?').bind(l));
	}
	statements.push(db.prepare('UPDATE lists SET updated_at = unixepoch() WHERE id = ?').bind(master));
	await db.batch(statements);
	return id;
}

export async function deleteGift(db: D1Database, master: string, itemId: string) {
	await db.prepare('DELETE FROM items WHERE id = ? AND list_id = ?').bind(itemId, master).run();
}

export async function removeFromList(db: D1Database, listId: string, itemId: string) {
	await db.prepare('DELETE FROM list_items WHERE list_id = ? AND item_id = ?').bind(listId, itemId).run();
}

export async function rateGift(db: D1Database, master: string, itemId: string, rating: number) {
	await db.prepare('UPDATE items SET rating = ?, updated_at = unixepoch() WHERE id = ? AND list_id = ?').bind(rating, itemId, master).run();
}

/** Save a new order: overall for the Everything list, or within one occasion list. */
export async function reorderGifts(db: D1Database, list: { id: string; kind: string }, master: string, ids: string[]) {
	await db.batch(
		ids.map((id, rank) =>
			list.kind === 'master'
				? db.prepare('UPDATE items SET rank = ? WHERE id = ? AND list_id = ?').bind(rank, id, master)
				: db.prepare('UPDATE list_items SET rank = ? WHERE list_id = ? AND item_id = ?').bind(rank, list.id, id)
		)
	);
}

/** A gift already in this Everything list with the same link or name, if any. */
export async function findDuplicate(db: D1Database, master: string, url: string | null, title: string | null) {
	const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	const { results } = await db.prepare('SELECT id, title, url FROM items WHERE list_id = ?').bind(master).all<{ id: string; title: string; url: string | null }>();
	const t = title ? norm(title) : null;
	return results.find((r) => (url && r.url && r.url === url) || (t && t.length > 6 && norm(r.title) === t)) ?? null;
}

export interface NewGift {
	url: string | null;
	title: string;
	image_url: string | null;
	price_cents: number | null;
	currency: string | null;
	store: string | null;
	category_id: string | null;
}

/**
 * Add many gifts at once (an imported wish list): one duplicate check against what's already
 * there, then everything saved together, so a long list takes a moment, not minutes.
 */
export async function addGiftsBulk(db: D1Database, master: string, gifts: NewGift[], lists: string[]): Promise<{ added: number; skipped: number }> {
	const allowed = await allowedLists(db, master);
	const onLists = lists.filter((l) => allowed.has(l));
	const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	const [{ results: existing }, max] = await Promise.all([
		db.prepare('SELECT title, url FROM items WHERE list_id = ?').bind(master).all<{ title: string; url: string | null }>(),
		db.prepare('SELECT COALESCE(MAX(rank), -1) AS r FROM items WHERE list_id = ?').bind(master).first<{ r: number }>()
	]);
	const urls = new Set(existing.map((e) => e.url).filter(Boolean));
	const titles = new Set(existing.map((e) => norm(e.title)));

	let rank = (max?.r ?? -1) + 1;
	let skipped = 0;
	const statements: D1PreparedStatement[] = [];
	const now = Math.floor(Date.now() / 1000);
	for (const g of gifts) {
		const t = norm(g.title);
		if ((g.url && urls.has(g.url)) || titles.has(t)) {
			skipped++;
			continue;
		}
		urls.add(g.url);
		titles.add(t);
		const id = newId('itm');
		statements.push(
			db
				.prepare(
					`INSERT INTO items (id, list_id, url, title, image_url, price_cents, currency, store, category_id, availability, rank, last_checked)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', ?, ?)`
				)
				.bind(id, master, g.url, g.title.slice(0, 200), g.image_url, g.price_cents, g.currency, g.store, g.category_id, rank++, g.url ? now : null)
		);
		if (g.price_cents != null) statements.push(db.prepare('INSERT INTO price_history (item_id, price_cents, currency) VALUES (?, ?, ?)').bind(id, g.price_cents, g.currency));
		for (const l of onLists)
			statements.push(db.prepare('INSERT OR IGNORE INTO list_items (list_id, item_id, rank) VALUES (?, ?, (SELECT COALESCE(MAX(rank), -1) + 1 FROM list_items WHERE list_id = ?))').bind(l, id, l));
	}
	for (const l of [master, ...onLists]) statements.push(db.prepare('UPDATE lists SET updated_at = unixepoch() WHERE id = ?').bind(l));
	// D1 takes batches of statements; keep each one a comfortable size.
	for (let i = 0; i < statements.length; i += 80) await db.batch(statements.slice(i, i + 80));
	return { added: gifts.length - skipped, skipped };
}
