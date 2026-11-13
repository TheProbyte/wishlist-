import { daysUntil } from '#lib/format.ts';
import { orderedLists } from '#lib/server/lists.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const lists = await orderedLists(locals.db, locals.user.id);
	return {
		upcoming: lists.filter((l) => (daysUntil(l.next_date) ?? -1) >= 0),
		undated: lists.filter((l) => !l.next_date)
	};
};
