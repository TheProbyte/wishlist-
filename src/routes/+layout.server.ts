import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	me: locals.viewer ? { id: locals.viewer.id, name: locals.viewer.name, avatar_url: locals.viewer.avatar_url } : null,
	authEnabled: locals.authEnabled
});
