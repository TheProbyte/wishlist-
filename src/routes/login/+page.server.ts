import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const next = url.searchParams.get('next') ?? '/';
	if (!locals.authEnabled || locals.viewer) redirect(303, next);
	return { next, cancelled: url.searchParams.has('cancelled') };
};
