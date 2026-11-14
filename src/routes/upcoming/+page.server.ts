import { daysUntil } from '#lib/format.ts';
import { orderedLists } from '#lib/server/lists.ts';
import { upcomingInCircles } from '#lib/server/people.ts';
import type { PageServerLoad } from './$types';

/** Everything with a date: your own lists, and (signed in) your people's occasions too. */
export const load: PageServerLoad = async ({ locals }) => {
	const [lists, people] = await Promise.all([
		orderedLists(locals.db, locals.user.id),
		locals.authEnabled ? upcomingInCircles(locals.db, locals.user.id, 366) : Promise.resolve([])
	]);
	return {
		upcoming: lists.filter((l) => (daysUntil(l.next_date) ?? -1) >= 0),
		undated: lists.filter((l) => !l.next_date),
		people
	};
};
