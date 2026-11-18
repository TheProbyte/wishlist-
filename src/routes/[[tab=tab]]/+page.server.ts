import { loadLists, listsActions } from '#lib/server/tabs/lists.ts';
import { peopleActions } from '#lib/server/tabs/people.ts';
import { meActions } from '#lib/server/tabs/me.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * The three tabs (Lists, People, You) live side by side in one swipeable frame, so their data
 * loads together and switching tabs never waits for the network. This is the Lists tab's part;
 * People and You load in the layout beside it, so each half can be refreshed alone.
 */
export const load: PageServerLoad = async (event) => {
	event.depends('app:lists');
	return { tab: event.params.tab ?? 'lists', listsTab: await loadLists(event) };
};

export const actions: Actions = { ...listsActions, ...peopleActions, ...meActions };
