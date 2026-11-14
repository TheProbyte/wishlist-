import { error, fail, redirect } from '@sveltejs/kit';
import { upcomingInCircles } from '#lib/server/people.ts';
import type { Actions, PageServerLoad } from './$types';

/** One circle: who's in it, what's coming up for them, and its invite link. Members only. */
async function ownCircle(locals: App.Locals, id: string) {
	if (!locals.authEnabled) error(400, 'Circles need Google sign-in, which isn’t switched on yet.');
	const circle = await locals.db
		.prepare('SELECT c.id, c.name, c.owner_id, c.invite_token FROM circles c JOIN circle_members m ON m.circle_id = c.id WHERE c.id = ? AND m.user_id = ?')
		.bind(id, locals.user.id)
		.first<{ id: string; name: string; owner_id: string; invite_token: string }>();
	if (!circle) error(404, 'That circle isn’t one of yours.');
	return circle;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const circle = await ownCircle(locals, params.id);
	const [{ results: members }, upcoming] = await Promise.all([
		locals.db
			.prepare(
				`SELECT u.id, u.name, u.avatar_url, u.sticker, u.paper,
				        (SELECT COUNT(*) FROM items i WHERE i.list_id = 'mst_' || u.id) AS gift_count
				 FROM circle_members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = ? ORDER BY m.joined_at`
			)
			.bind(circle.id)
			.all<{ id: string; name: string; avatar_url: string | null; sticker: string | null; paper: string | null; gift_count: number }>(),
		upcomingInCircles(locals.db, locals.user.id, 365)
	]);
	const ids = new Set(members.map((m) => m.id));
	const here = upcoming.filter((u) => ids.has(u.personId));
	return {
		circle: { id: circle.id, name: circle.name, invite_token: circle.invite_token, mine: circle.owner_id === locals.user.id },
		me: locals.user.id,
		members: members.map((m) => ({ ...m, next: here.find((u) => u.personId === m.id) ?? null })),
		upcoming: here.slice(0, 12)
	};
};

export const actions: Actions = {
	rename: async ({ request, locals, params }) => {
		const circle = await ownCircle(locals, params.id);
		if (circle.owner_id !== locals.user.id) return fail(403, { renameError: 'Only whoever made the circle can rename it.' });
		const name = String((await request.formData()).get('name') ?? '').trim().slice(0, 50);
		if (!name) return fail(400, { renameError: 'Give it a name.' });
		await locals.db.prepare('UPDATE circles SET name = ? WHERE id = ?').bind(name, circle.id).run();
		return { renamed: name };
	},
	leave: async ({ locals, params }) => {
		const circle = await ownCircle(locals, params.id);
		await locals.db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').bind(circle.id, locals.user.id).run();
		await locals.db.prepare('DELETE FROM circles WHERE id = ? AND NOT EXISTS (SELECT 1 FROM circle_members WHERE circle_id = ?)').bind(circle.id, circle.id).run();
		redirect(303, '/people');
	}
};
