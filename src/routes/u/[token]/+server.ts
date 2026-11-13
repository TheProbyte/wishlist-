import { error, redirect } from '@sveltejs/kit';
import { masterId, newToken } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

/** Old "share everything" links now open the person's Everything list. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const owner = await locals.db.prepare('SELECT id FROM users WHERE share_token = ?').bind(params.token).first<{ id: string }>();
	if (!owner) error(404, 'These lists aren’t shared any more.');
	const master = masterId(owner.id);
	const row = await locals.db.prepare('SELECT share_token FROM lists WHERE id = ?').bind(master).first<{ share_token: string | null }>();
	let token = row?.share_token;
	if (!token) {
		token = newToken();
		await locals.db.prepare('UPDATE lists SET share_token = ? WHERE id = ?').bind(token, master).run();
	}
	redirect(307, `/s/${token}`);
};
