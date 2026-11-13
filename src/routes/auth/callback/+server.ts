import { error, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_DAYS, createSession, googleProfile, upsertGoogleUser } from '#lib/server/auth.ts';
import { GIVER_COOKIE } from '#lib/server/giving.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const state = cookies.get('oauth_state');
	const next = cookies.get('oauth_next') ?? '/';
	cookies.delete('oauth_state', { path: '/auth' });
	cookies.delete('oauth_next', { path: '/auth' });
	if (url.searchParams.get('error')) redirect(303, '/login?cancelled=1');
	const code = url.searchParams.get('code');
	if (!code || !state || state !== url.searchParams.get('state')) error(400, 'That sign-in link expired. Please try again.');

	const profile = await googleProfile(url.origin, code);
	const user = await upsertGoogleUser(locals.db, profile);
	const token = await createSession(locals.db, user.id);
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: SESSION_DAYS * 86400 });

	// Gifts claimed on share links before signing in become this account's claims.
	const giver = cookies.get(GIVER_COOKIE);
	if (giver) await locals.db.prepare('UPDATE claims SET giver_user_id = ? WHERE giver_token = ? AND giver_user_id IS NULL').bind(user.id, giver).run();

	redirect(303, next);
};
