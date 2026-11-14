import { loadMe, meActions } from '#lib/server/tabs/me.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadMe(event);

export const actions: Actions = { saveProfile: (event) => meActions.saveProfile(event) };
