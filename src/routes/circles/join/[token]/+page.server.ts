import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function circleFor(db: D1Database, token: string) {
	const c = await db.prepare('SELECT c.id, c.name, u.name AS owner FROM circles c JOIN users u ON u.id = c.owner_id WHERE c.invite_token = ?').bind(token).first<{ id: string; name: string; owner: string }>();
	if (!c) error(404, 'That invite link doesn’t work any more.');
	return c;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.authEnabled) error(400, 'Circles need Google sign-in, which isn’t switched on yet.');
	const circle = await circleFor(locals.db, params.token);
	const member = await locals.db.prepare('SELECT 1 FROM circle_members WHERE circle_id = ? AND user_id = ?').bind(circle.id, locals.user.id).first();
	if (member) redirect(303, '/people');
	const { results } = await locals.db
		.prepare('SELECT u.name, u.avatar_url FROM circle_members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = ? ORDER BY m.joined_at')
		.bind(circle.id)
		.all<{ name: string; avatar_url: string | null }>();
	return { circle, members: results };
};

export const actions: Actions = {
	default: async ({ locals, params }) => {
		const circle = await circleFor(locals.db, params.token);
		await locals.db.prepare('INSERT OR IGNORE INTO circle_members (circle_id, user_id) VALUES (?, ?)').bind(circle.id, locals.user.id).run();
		redirect(303, '/people');
	}
};
