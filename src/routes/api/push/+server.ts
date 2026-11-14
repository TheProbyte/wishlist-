import { json } from '@sveltejs/kit';
import { vapidKeys } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

/** The app's public key, for the browser to subscribe with. */
export const GET: RequestHandler = async ({ locals }) => json({ key: (await vapidKeys(locals.db)).publicKey });

/** Turn notifications on in this browser. */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.authEnabled) return json({ error: 'Notifications need sign-in.' }, { status: 400 });
	const sub = (await request.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
	if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys.auth) return json({ error: 'That isn’t a subscription.' }, { status: 400 });
	await locals.db
		.prepare('INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth')
		.bind(sub.endpoint.slice(0, 1000), locals.user.id, sub.keys.p256dh.slice(0, 200), sub.keys.auth.slice(0, 100))
		.run();
	// The app's address, given to push services as who's sending.
	await locals.db.prepare("INSERT INTO app_keys (name, value) VALUES ('origin', ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value").bind(url.origin).run();
	return json({ ok: true });
};

/** Turn them off in this browser. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
	if (endpoint) await locals.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(endpoint, locals.user.id).run();
	return json({ ok: true });
};
