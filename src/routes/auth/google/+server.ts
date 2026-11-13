import { error, redirect } from '@sveltejs/kit';
import { authEnabled, googleAuthUrl } from '#lib/server/auth.ts';
import { newToken } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!authEnabled()) error(404, 'Sign-in isn’t switched on yet.');
	const state = newToken();
	const next = url.searchParams.get('next') ?? '/';
	const opts = { path: '/auth', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 600 } as const;
	cookies.set('oauth_state', state, opts);
	cookies.set('oauth_next', next.startsWith('/') && !next.startsWith('//') ? next : '/', opts);
	redirect(302, googleAuthUrl(url.origin, state));
};
