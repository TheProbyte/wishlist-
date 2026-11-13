import { env } from 'cloudflare:workers';
import { error, json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, authEnabled, localUser, userFromSession } from '#lib/server/auth.ts';
import { ensureSchema } from '#lib/server/schema.ts';

/** Pages anyone can open: share links, sign-in, images, app files. */
const PUBLIC = [/^\/icons\//, /^\/service-worker\.js$/, /^\/s\//, /^\/u\//, /^\/login\/?$/, /^\/auth\//, /^\/img\//, /^\/manifest\.webmanifest$/, /^\/robots\.txt$/];

// Ask for the two main font files up front, alongside the styles, so text never waits on them.
const preload = ({ type, path }: { type: string; path: string }) =>
	type === 'js' || type === 'css' || (type === 'font' && /-latin-(opsz|400)-normal/.test(path));

export const handle: Handle = async ({ event, resolve: kitResolve }) => {
	const resolve = (e: typeof event) => kitResolve(e, { preload });
	const db = env.DB;
	if (!db) error(500, 'Database binding "DB" is missing. Check wrangler.jsonc.');
	await ensureSchema(db);
	event.locals.db = db;
	event.locals.authEnabled = authEnabled();

	if (!event.locals.authEnabled) {
		const user = await localUser(db);
		event.locals.user = user;
		event.locals.viewer = user;
		return resolve(event);
	}

	const token = event.cookies.get(SESSION_COOKIE);
	const user = token ? await userFromSession(db, token) : null;
	event.locals.viewer = user;
	if (user) {
		event.locals.user = user;
	} else if (!PUBLIC.some((re) => re.test(event.url.pathname))) {
		if (event.url.pathname.startsWith('/api/')) return json({ error: 'Sign in first.' }, { status: 401 });
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	return resolve(event);
};
