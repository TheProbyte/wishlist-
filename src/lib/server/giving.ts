import { fail, type Cookies } from '@sveltejs/kit';
import { getItems, newId, newToken } from './db';
import type { Item } from '#lib/types.ts';

/**
 * The giver side, shared by a single list's link (/s/…) and the "everything" link (/u/…).
 * Givers need no account: a random id in a cookie marks which claims are theirs.
 */
export const GIVER_COOKIE = 'giver';
export const NAME_COOKIE = 'giver_name';
const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 400 } as const;

export type GiverItem = Item & { claimed: number; mine: number };

/** A list's gifts with how many are claimed, and how many by this giver. */
export async function giverItems(db: D1Database, listId: string, giver: string | null): Promise<GiverItem[]> {
	const [items, claims] = await Promise.all([
		getItems(db, listId),
		db
			.prepare(
				`SELECT c.item_id, SUM(c.quantity) AS claimed, SUM(CASE WHEN c.giver_token = ? THEN c.quantity ELSE 0 END) AS mine
				 FROM claims c JOIN items i ON i.id = c.item_id WHERE i.list_id = ? GROUP BY c.item_id`
			)
			.bind(giver ?? '', listId)
			.all<{ item_id: string; claimed: number; mine: number }>()
	]);
	const byItem = new Map(claims.results.map((c) => [c.item_id, c]));
	return items.map((i) => ({ ...i, claimed: byItem.get(i.id)?.claimed ?? 0, mine: byItem.get(i.id)?.mine ?? 0 }));
}

type FindItem = (itemId: string) => Promise<{ id: string; quantity: number } | null>;

export async function claim(db: D1Database, request: Request, cookies: Cookies, find: FindItem) {
	const form = await request.formData();
	const name = String(form.get('name') ?? '').trim().slice(0, 40);
	if (!name) return fail(400, { error: 'Add your name so others know it’s taken.' });
	const item = await find(String(form.get('id') ?? ''));
	if (!item) return fail(404, { error: 'That gift has been removed.' });

	const taken = await db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM claims WHERE item_id = ?').bind(item.id).first<{ n: number }>();
	if ((taken?.n ?? 0) >= item.quantity) return fail(409, { error: 'Someone just got that one.' });

	let giver = cookies.get(GIVER_COOKIE);
	if (!giver) {
		giver = newToken();
		cookies.set(GIVER_COOKIE, giver, cookieOpts);
	}
	cookies.set(NAME_COOKIE, name, cookieOpts);
	await db.prepare('INSERT INTO claims (id, item_id, giver_token, giver_name, quantity) VALUES (?, ?, ?, ?, 1)').bind(newId('clm'), item.id, giver, name).run();
	return { claimed: item.id };
}

export async function unclaim(db: D1Database, request: Request, cookies: Cookies, find: FindItem) {
	const giver = cookies.get(GIVER_COOKIE);
	const item = await find(String((await request.formData()).get('id') ?? ''));
	if (!giver || !item) return fail(400, { error: 'Nothing to undo.' });
	await db
		.prepare('DELETE FROM claims WHERE id = (SELECT id FROM claims WHERE item_id = ? AND giver_token = ? ORDER BY created_at DESC LIMIT 1)')
		.bind(item.id, giver)
		.run();
	return { unclaimed: item.id };
}
