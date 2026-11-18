import { daysUntil, occasionDate } from '#lib/format.ts';
import { ensureMaster, masterId } from './db';
import type { List } from '#lib/types.ts';

export type ListWithCount = List & { item_count: number; next_date: string | null };

const COUNTED = `SELECT l.*, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count FROM lists l`;

/**
 * Someone's occasion lists (or one kid's) in display order: upcoming soonest first, then
 * undated, then past. The Everything list is not included.
 */
export async function orderedLists(db: D1Database, userId: string, kidId: string | null = null): Promise<ListWithCount[]> {
	const scope = kidId ? 'l.kid_id = ?' : 'l.owner_id = ? AND l.kid_id IS NULL';
	const { results } = await db
		.prepare(`${COUNTED} WHERE ${scope} AND l.kind = 'list' ORDER BY l.updated_at DESC`)
		.bind(kidId ?? userId)
		.all<List & { item_count: number }>();
	return arrange(results);
}

/** Soonest occasion first, then undated ones, then those just gone; lists placed by hand keep their places. */
function arrange(rows: (List & { item_count: number })[]): ListWithCount[] {
	const lists = rows.map((l) => ({ ...l, next_date: occasionDate(l.occasion, l.occasion_date) }));
	const bucket = (l: ListWithCount) => {
		const d = daysUntil(l.next_date);
		return d == null ? 1 : d >= 0 ? 0 : 2;
	};
	return lists.sort((a, b) => {
		const ba = bucket(a);
		const bb = bucket(b);
		if (ba !== bb) return ba - bb;
		if (ba === 0) return (a.next_date ?? '').localeCompare(b.next_date ?? '');
		return b.updated_at - a.updated_at;
	})
	// Arranged by hand: those keep their places, after any not placed yet (new ones show first).
	.sort((a, b) => (a.position ?? -1) - (b.position ?? -1));
}

/**
 * Everything on someone's shelf in one lookup: their Everything list and their kids', and every
 * occasion list, ordered, grouped by whose it is (null for their own, else the kid's id).
 */
export async function wholeShelf(db: D1Database, ownerId: string) {
	const { results } = await db
		.prepare(
			`SELECT l.*, CASE WHEN l.kind = 'master' THEN (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id)
			        ELSE (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) END AS item_count
			 FROM lists l WHERE l.owner_id = ? ORDER BY l.updated_at DESC`
		)
		.bind(ownerId)
		.all<List & { item_count: number }>();
	const masters = new Map<string | null, List & { item_count: number }>();
	const rows = new Map<string | null, (List & { item_count: number })[]>();
	for (const l of results) {
		if (l.kind === 'master') masters.set(l.kid_id ?? null, l);
		else if (l.kind === 'list') rows.set(l.kid_id ?? null, [...(rows.get(l.kid_id ?? null) ?? []), l]);
	}
	return {
		/** Their (or a kid's) Everything list, made if it's somehow missing. */
		master: async (kidId: string | null = null) => masters.get(kidId) ?? (await masterListEnsured(db, ownerId, kidId)),
		lists: (kidId: string | null = null) => arrange(rows.get(kidId) ?? [])
	};
}

/** Someone's (or a kid's) Everything list with its gift count. */
export async function masterList(db: D1Database, personId: string): Promise<(List & { item_count: number }) | null> {
	return db
		.prepare('SELECT l.*, (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count FROM lists l WHERE l.id = ?')
		.bind(masterId(personId))
		.first<List & { item_count: number }>();
}

/** Like masterList, but creates the Everything list in the rare case it doesn't exist yet. */
export async function masterListEnsured(db: D1Database, ownerId: string, kidId: string | null = null) {
	const found = await masterList(db, kidId ?? ownerId);
	if (found) return found;
	await ensureMaster(db, ownerId, kidId);
	return (await masterList(db, kidId ?? ownerId))!;
}
