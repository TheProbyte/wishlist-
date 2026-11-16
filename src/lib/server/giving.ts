import { fail, type Cookies } from '@sveltejs/kit';
import { getItems, masterOf, newId, newToken } from './db';
import type { Item, List, User } from '#lib/types.ts';

/**
 * The giver side, shared by every place someone shops from a list: share links (/s/…),
 * the old share-everything link (/u/…), and people in your circles.
 *
 * Claims belong to the gift, so a gift claimed on one list is taken everywhere it appears.
 * Givers without an account are recognised by a random id in a cookie; signed-in givers
 * by their account. The list's owner never sees claims.
 */
export const GIVER_COOKIE = 'giver';
export const NAME_COOKIE = 'giver_name';
const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 400 } as const;

export type { GiverItem } from '#lib/types.ts';
import type { GiverItem } from '#lib/types.ts';

type ListRef = Pick<List, 'id' | 'kind' | 'owner_id' | 'kid_id'>;

export async function giverItems(
	db: D1Database,
	list: ListRef,
	giver: { token: string | null; userId: string | null },
	hideClaims = false
): Promise<GiverItem[]> {
	// Long shop descriptions are cut for givers' pages (the start is what's worth reading), which
	// keeps big lists light to send.
	const items = (await getItems(db, list)).map((i) => (i.description && i.description.length > 600 ? { ...i, description: `${i.description.slice(0, 597).trimEnd()}…` } : i));
	const none = { claimed: 0, mine: 0, myNote: null, chipped: 0, chippers: 0, myChip: 0 };
	if (hideClaims) return items.map((i) => ({ ...i, ...none }));
	const me = [giver.token ?? '', giver.userId ?? ''];
	const [claims, chips] = await Promise.all([
		db
			.prepare(
				`SELECT c.item_id, SUM(c.quantity) AS claimed,
				        SUM(CASE WHEN c.giver_token = ? OR (c.giver_user_id IS NOT NULL AND c.giver_user_id = ?) THEN c.quantity ELSE 0 END) AS mine,
				        MAX(CASE WHEN c.giver_token = ? OR (c.giver_user_id IS NOT NULL AND c.giver_user_id = ?) THEN c.note END) AS note
				 FROM claims c JOIN items i ON i.id = c.item_id WHERE i.list_id = ? GROUP BY c.item_id`
			)
			.bind(...me, ...me, masterOf(list))
			.all<{ item_id: string; claimed: number; mine: number; note: string | null }>(),
		db
			.prepare(
				`SELECT k.item_id, SUM(k.amount_cents) AS chipped, COUNT(*) AS chippers,
				        SUM(CASE WHEN k.giver_token = ? OR (k.giver_user_id IS NOT NULL AND k.giver_user_id = ?) THEN k.amount_cents ELSE 0 END) AS myChip,
				        MAX(CASE WHEN k.giver_token = ? OR (k.giver_user_id IS NOT NULL AND k.giver_user_id = ?) THEN k.note END) AS note
				 FROM contributions k JOIN items i ON i.id = k.item_id WHERE i.list_id = ? GROUP BY k.item_id`
			)
			.bind(...me, ...me, masterOf(list))
			.all<{ item_id: string; chipped: number; chippers: number; myChip: number; note: string | null }>()
	]);
	const byItem = new Map(claims.results.map((c) => [c.item_id, c]));
	const chipBy = new Map(chips.results.map((c) => [c.item_id, c]));
	return items.map((i) => {
		const c = byItem.get(i.id);
		const k = chipBy.get(i.id);
		return { ...i, claimed: c?.claimed ?? 0, mine: c?.mine ?? 0, myNote: c?.note ?? k?.note ?? null, chipped: k?.chipped ?? 0, chippers: k?.chippers ?? 0, myChip: k?.myChip ?? 0 };
	});
}

/** Whether this person owns the list (or is the parent of the kid it belongs to). */
export const isOwner = (list: Pick<List, 'owner_id'>, viewer: User | null) => !!viewer && viewer.id === list.owner_id;

type FindItem = (itemId: string) => Promise<{ id: string; quantity: number; owner_id: string; price_cents?: number | null } | null>;

/** Find a gift in a given Everything list, with its owner. */
export const giftInMaster = (db: D1Database, master: string): FindItem => (itemId) =>
	db
		.prepare('SELECT i.id, i.quantity, i.price_cents, l.owner_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.list_id = ? AND i.id = ?')
		.bind(master, itemId)
		.first<{ id: string; quantity: number; owner_id: string; price_cents: number | null }>();

function giverToken(cookies: Cookies): string {
	let token = cookies.get(GIVER_COOKIE);
	if (!token) {
		token = newToken();
		cookies.set(GIVER_COOKIE, token, cookieOpts);
	}
	return token;
}

export async function claim(db: D1Database, request: Request, cookies: Cookies, viewer: User | null, find: FindItem) {
	const form = await request.formData();
	const name = String(form.get('name') ?? viewer?.name ?? '').trim().slice(0, 40);
	if (!name) return fail(400, { error: 'Add your name so others know it’s taken.' });
	const item = await find(String(form.get('id') ?? ''));
	if (!item) return fail(404, { error: 'That gift has been removed.' });
	if (viewer && viewer.id === item.owner_id) return fail(400, { error: 'That’s your own gift.' });

	const taken = await db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM claims WHERE item_id = ?').bind(item.id).first<{ n: number }>();
	if ((taken?.n ?? 0) >= item.quantity) return fail(409, { error: 'Someone just got that one.' });
	const chipping = await db.prepare('SELECT COUNT(*) AS n FROM contributions WHERE item_id = ?').bind(item.id).first<{ n: number }>();
	if (chipping?.n) return fail(409, { error: 'People are already chipping in on this one. Chip in too?' });

	const token = giverToken(cookies);
	cookies.set(NAME_COOKIE, name, cookieOpts);
	await db
		.prepare('INSERT INTO claims (id, item_id, giver_token, giver_name, giver_user_id, quantity) VALUES (?, ?, ?, ?, ?, 1)')
		.bind(newId('clm'), item.id, token, name, viewer?.id ?? null)
		.run();
	return { claimed: item.id };
}

export async function unclaim(db: D1Database, request: Request, cookies: Cookies, viewer: User | null, find: FindItem) {
	const token = cookies.get(GIVER_COOKIE) ?? '';
	const item = await find(String((await request.formData()).get('id') ?? ''));
	if (!item || (!token && !viewer)) return fail(400, { error: 'Nothing to undo.' });
	await db
		.prepare(
			`DELETE FROM claims WHERE id = (SELECT id FROM claims WHERE item_id = ? AND (giver_token = ? OR (giver_user_id IS NOT NULL AND giver_user_id = ?))
			 ORDER BY created_at DESC LIMIT 1)`
		)
		.bind(item.id, token, viewer?.id ?? '')
		.run();
	return { unclaimed: item.id };
}

/** Pricey gifts can be split: from this price, givers can chip in part of it instead. */
export const SPLIT_FROM_CENTS = 6000;

const mine = `(giver_token = ? OR (giver_user_id IS NOT NULL AND giver_user_id = ?))`;

/** Chip in part of a pricey gift. It counts as taken once the pieces cover the price. */
export async function contribute(db: D1Database, request: Request, cookies: Cookies, viewer: User | null, find: FindItem) {
	const form = await request.formData();
	const name = String(form.get('name') ?? viewer?.name ?? '').trim().slice(0, 40);
	if (!name) return fail(400, { error: 'Add your name so the others know who’s in.' });
	const item = await find(String(form.get('id') ?? ''));
	if (!item) return fail(404, { error: 'That gift has been removed.' });
	if (viewer && viewer.id === item.owner_id) return fail(400, { error: 'That’s your own gift.' });
	if (!item.price_cents || item.price_cents < SPLIT_FROM_CENTS || item.quantity !== 1) return fail(400, { error: 'This one isn’t one to split.' });
	const amount = Math.round(Number(String(form.get('amount') ?? '').replace(/[^\d.]/g, '')) * 100);
	if (!amount || amount < 100) return fail(400, { error: 'How much would you like to put in?' });
	const [claimed, covered] = await Promise.all([
		db.prepare('SELECT COUNT(*) AS n FROM claims WHERE item_id = ?').bind(item.id).first<{ n: number }>(),
		db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS n FROM contributions WHERE item_id = ?').bind(item.id).first<{ n: number }>()
	]);
	if (claimed?.n) return fail(409, { error: 'Someone’s getting the whole thing already.' });
	if ((covered?.n ?? 0) >= item.price_cents) return fail(409, { error: 'It’s all covered already.' });
	const token = giverToken(cookies);
	cookies.set(NAME_COOKIE, name, cookieOpts);
	await db
		.prepare('INSERT INTO contributions (id, item_id, giver_token, giver_user_id, giver_name, amount_cents) VALUES (?, ?, ?, ?, ?, ?)')
		.bind(newId('chp'), item.id, token, viewer?.id ?? null, name, Math.min(amount, item.price_cents - (covered?.n ?? 0)))
		.run();
	return { chipped: item.id };
}

/** Take back your part. */
export async function uncontribute(db: D1Database, request: Request, cookies: Cookies, viewer: User | null, find: FindItem) {
	const token = cookies.get(GIVER_COOKIE) ?? '';
	const item = await find(String((await request.formData()).get('id') ?? ''));
	if (!item || (!token && !viewer)) return fail(400, { error: 'Nothing to undo.' });
	await db.prepare(`DELETE FROM contributions WHERE item_id = ? AND ${mine}`).bind(item.id, token, viewer?.id ?? '').run();
	return { unchipped: item.id };
}

/** Your own note on a gift you're getting (or chipping in on). Only you ever see it. */
export async function saveGiverNote(db: D1Database, request: Request, cookies: Cookies, viewer: User | null, find: FindItem) {
	const token = cookies.get(GIVER_COOKIE) ?? '';
	const form = await request.formData();
	const item = await find(String(form.get('id') ?? ''));
	if (!item || (!token && !viewer)) return fail(400, { error: 'Nothing to note.' });
	const note = String(form.get('note') ?? '').trim().slice(0, 200) || null;
	await db.batch([
		db.prepare(`UPDATE claims SET note = ? WHERE item_id = ? AND ${mine}`).bind(note, item.id, token, viewer?.id ?? ''),
		db.prepare(`UPDATE contributions SET note = ? WHERE item_id = ? AND ${mine}`).bind(note, item.id, token, viewer?.id ?? '')
	]);
	return { noted: item.id };
}
