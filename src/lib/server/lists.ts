import { daysUntil, occasionDate } from '#lib/format.ts';
import { masterId } from './db';
import type { List } from '#lib/types.ts';

export type ListWithCount = List & { item_count: number; next_date: string | null };

/**
 * Someone's occasion lists (or one kid's) in display order: upcoming soonest first, then
 * undated, then past. The Everything list is not included.
 */
export async function orderedLists(db: D1Database, userId: string, kidId: string | null = null): Promise<ListWithCount[]> {
	const scope = kidId ? 'l.kid_id = ?' : 'l.owner_id = ? AND l.kid_id IS NULL';
	const { results } = await db
		.prepare(
			`SELECT l.*, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count
			 FROM lists l WHERE ${scope} AND l.kind = 'list' ORDER BY l.updated_at DESC`
		)
		.bind(kidId ?? userId)
		.all<List & { item_count: number }>();

	const lists = results.map((l) => ({ ...l, next_date: occasionDate(l.occasion, l.occasion_date) }));
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
	});
}

/** Someone's (or a kid's) Everything list with its gift count. */
export async function masterList(db: D1Database, personId: string): Promise<(List & { item_count: number }) | null> {
	return db
		.prepare('SELECT l.*, (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count FROM lists l WHERE l.id = ?')
		.bind(masterId(personId))
		.first<List & { item_count: number }>();
}
