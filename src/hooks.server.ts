import { env } from 'cloudflare:workers';
import { error, json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, authEnabled, localUser, ownerMarks, rememberOwner, userFromSession } from '#lib/server/auth.ts';
import { ensureSchema } from '#lib/server/schema.ts';
import { isHighlight, resolveTheme, themeBackground } from '#lib/themes.ts';

/** Pages anyone can open: share links, sign-in, images, app files. */
const PUBLIC = [/^\/icons\//, /^\/og\//, /^\/service-worker\.js$/, /^\/s\//, /^\/u\//, /^\/login\/?$/, /^\/auth\//, /^\/img\//, /^\/manifest\.webmanifest$/, /^\/robots\.txt$/];

// Ask for the two main font files up front, alongside the styles, so text never waits on them.
const preload = ({ type, path }: { type: string; path: string }) =>
	type === 'js' || type === 'css' || (type === 'font' && /-latin-(opsz|400)-normal/.test(path));

export const handle: Handle = async ({ event, resolve: kitResolve }) => {
	// Pages arrive already in your theme (no flash of the default colours).
	const resolve = async (e: typeof event) => {
		const page = e.request.method === 'GET' && !e.url.pathname.endsWith('__data.json') && !e.url.pathname.startsWith('/api/') && (e.request.headers.get('accept') ?? '').includes('text/html');
		const look = page && e.locals.user ? await e.locals.db.prepare('SELECT theme, highlight FROM users WHERE id = ?').bind(e.locals.user.id).first<{ theme: string | null; highlight: string | null }>().catch(() => null) : null;
		const theme = resolveTheme(look?.theme);
		const highlight = isHighlight(look?.highlight) && look.highlight !== 'auto' ? look.highlight : null;
		if (!theme && !highlight) return kitResolve(e, { preload });
		return kitResolve(e, {
			preload,
			transformPageChunk: ({ html }) =>
				html
					.replace('<html lang="en" class="dark"', `<html lang="en" class="dark"${theme ? ` data-theme="${theme}"` : ''}${highlight ? ` data-highlight="${highlight}"` : ''}`)
					.replace('<meta name="theme-color" content="#2b1d14" />', `<meta name="theme-color" content="${themeBackground(theme)}" />`)
		});
	};
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
		// Devices signed in before owner markers existed get theirs now (once).
		if (!ownerMarks(event.cookies).length) await rememberOwner(db, event.cookies, user.id, event.url.protocol === 'https:');
	} else if (!PUBLIC.some((re) => re.test(event.url.pathname))) {
		if (event.url.pathname.startsWith('/api/')) return json({ error: 'Sign in first.' }, { status: 401 });
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	return resolve(event);
};
