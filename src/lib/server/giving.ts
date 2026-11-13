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

export type GiverItem = Item & { claimed: number; mine: number };

type ListRef = Pick<List, 'id' | 'kind' | 'owner_id' | 'kid_id'>;

export async function giverItems(
	db: D1Database,
	list: ListRef,
	giver: { token: string | null; userId: string | null },
	hideClaims = false
): Promise<GiverItem[]> {
	const items = await getItems(db, list);
	if (hideClaims) return items.map((i) => ({ ...i, claimed: 0, mine: 0 }));
	const { results } = await db
		.prepare(
			`SELECT c.item_id, SUM(c.quantity) AS claimed,
			        SUM(CASE WHEN c.giver_token = ? OR (c.giver_user_id IS NOT NULL AND c.giver_user_id = ?) THEN c.quantity ELSE 0 END) AS mine
			 FROM claims c JOIN items i ON i.id = c.item_id WHERE i.list_id = ? GROUP BY c.item_id`
		)
		.bind(giver.token ?? '', giver.userId ?? '', masterOf(list))
		.all<{ item_id: string; claimed: number; mine: number }>();
	const byItem = new Map(results.map((c) => [c.item_id, c]));
	return items.map((i) => ({ ...i, claimed: byItem.get(i.id)?.claimed ?? 0, mine: byItem.get(i.id)?.mine ?? 0 }));
}

/** Whether this person owns the list (or is the parent of the kid it belongs to). */
export const isOwner = (list: Pick<List, 'owner_id'>, viewer: User | null) => !!viewer && viewer.id === list.owner_id;

type FindItem = (itemId: string) => Promise<{ id: string; quantity: number; owner_id: string } | null>;

/** Find a gift in a given Everything list, with its owner. */
export const giftInMaster = (db: D1Database, master: string): FindItem => (itemId) =>
	db
		.prepare('SELECT i.id, i.quantity, l.owner_id FROM items i JOIN lists l ON l.id = i.list_id WHERE i.list_id = ? AND i.id = ?')
		.bind(master, itemId)
		.first<{ id: string; quantity: number; owner_id: string }>();

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
