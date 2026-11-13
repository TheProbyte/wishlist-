import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSession } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await deleteSession(locals.db, token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/login');
};
