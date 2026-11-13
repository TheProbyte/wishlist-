import { daysUntil, occasionDate } from '#lib/format.ts';
import type { List } from '#lib/types.ts';

export type ListWithCount = List & { item_count: number; next_date: string | null };

/** The user's lists in display order: upcoming soonest first, then undated, then past. */
export async function orderedLists(db: D1Database, userId: string): Promise<ListWithCount[]> {
	const { results } = await db
		.prepare(
			`SELECT l.*, (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count
			 FROM lists l WHERE l.owner_id = ? ORDER BY l.updated_at DESC`
		)
		.bind(userId)
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
