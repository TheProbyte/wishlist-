import { loadMe } from '#lib/server/tabs/me.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadMe(event);
