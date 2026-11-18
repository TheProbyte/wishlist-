import { loadPeople } from '#lib/server/tabs/people.ts';
import { loadMe } from '#lib/server/tabs/me.ts';
import type { LayoutServerLoad } from './$types';

/**
 * The People and You tabs. They load with the Lists tab (in the same request, sharing lookups),
 * but refresh on their own: `invalidate('app:people')` reloads just these, and a change on the
 * Lists tab (`invalidate('app:lists')`) leaves them be.
 */
export const load: LayoutServerLoad = async (event) => {
	event.depends('app:people');
	const [peopleTab, meTab] = await Promise.all([loadPeople(event), loadMe(event)]);
	return { peopleTab, meTab };
};
