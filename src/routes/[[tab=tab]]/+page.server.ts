import { loadLists, listsActions } from '#lib/server/tabs/lists.ts';
import { loadPeople, peopleActions } from '#lib/server/tabs/people.ts';
import { loadMe, meActions } from '#lib/server/tabs/me.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * The three tabs (Lists, People, You) live side by side in one swipeable frame, so their data
 * loads together and switching tabs never waits for the network.
 */
export const load: PageServerLoad = async (event) => {
	const [listsTab, peopleTab, meTab] = await Promise.all([loadLists(event), loadPeople(event), loadMe(event)]);
	return { tab: event.params.tab ?? 'lists', listsTab, peopleTab, meTab };
};

export const actions: Actions = { ...listsActions, ...peopleActions, ...meActions };
