import { error, fail, redirect } from '@sveltejs/kit';
import { drawNames, exchangeFor } from '#lib/server/santa.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.authEnabled) error(404, 'Secret Santa needs Google sign-in.');
	const x = await exchangeFor(locals.db, params.id, locals.user.id);
	if (!x) error(404, 'That Secret Santa isn’t one you’re in.');
	const [{ results: members }, recipient] = await Promise.all([
		locals.db
			.prepare('SELECT u.id, u.name, u.avatar_url FROM exchange_members m JOIN users u ON u.id = m.user_id WHERE m.exchange_id = ? ORDER BY m.joined_at')
			.bind(x.id)
			.all<{ id: string; name: string; avatar_url: string | null }>(),
		// Only ever your own match: nobody, not even the organiser, sees the others.
		x.recipient_id ? locals.db.prepare('SELECT id, name, avatar_url FROM users WHERE id = ?').bind(x.recipient_id).first<{ id: string; name: string; avatar_url: string | null }>() : null
	]);
	return {
		exchange: { id: x.id, name: x.name, budget_cents: x.budget_cents, currency: x.currency, exchange_date: x.exchange_date, drawn: !!x.drawn_at, invite_token: x.invite_token },
		isOrganiser: x.owner_id === locals.user.id,
		members,
		recipient
	};
};

async function organiser(locals: App.Locals, id: string) {
	const x = await exchangeFor(locals.db, id, locals.user.id);
	if (!x || x.owner_id !== locals.user.id) error(403, 'Only the organiser can do that.');
	return x;
}

export const actions: Actions = {
	draw: async ({ locals, params }) => {
		const x = await organiser(locals, params.id);
		const { results } = await locals.db.prepare('SELECT user_id FROM exchange_members WHERE exchange_id = ?').bind(x.id).all<{ user_id: string }>();
		if (results.length < 3) return fail(400, { error: 'You need at least 3 people to draw names.' });
		const pairs = drawNames(results.map((r) => r.user_id));
		await locals.db.batch([
			...[...pairs].map(([giver, receiver]) => locals.db.prepare('UPDATE exchange_members SET recipient_id = ? WHERE exchange_id = ? AND user_id = ?').bind(receiver, x.id, giver)),
			locals.db.prepare('UPDATE exchanges SET drawn_at = unixepoch() WHERE id = ?').bind(x.id)
		]);
		return { drawn: true };
	},
	remove: async ({ request, locals, params }) => {
		const x = await organiser(locals, params.id);
		if (x.drawn_at) return fail(400, { error: 'Names are already drawn.' });
		const who = String((await request.formData()).get('user') ?? '');
		if (who === x.owner_id) return fail(400, { error: 'The organiser stays in.' });
		await locals.db.prepare('DELETE FROM exchange_members WHERE exchange_id = ? AND user_id = ?').bind(x.id, who).run();
		return { removed: who };
	},
	leave: async ({ locals, params }) => {
		const x = await exchangeFor(locals.db, params.id, locals.user.id);
		if (!x) error(404, 'Not found');
		if (x.owner_id === locals.user.id) return fail(400, { error: 'You’re the organiser: delete it instead.' });
		if (x.drawn_at) return fail(400, { error: 'Names are already drawn, so leaving would leave someone without a giver. Ask the organiser to reopen it first.' });
		await locals.db.prepare('DELETE FROM exchange_members WHERE exchange_id = ? AND user_id = ?').bind(x.id, locals.user.id).run();
		redirect(303, '/people');
	},
	/** The organiser can delete it at any time, drawn or not: everyone's match goes with it. */
	delete: async ({ locals, params }) => {
		const x = await organiser(locals, params.id);
		await locals.db.batch([
			locals.db.prepare('DELETE FROM exchange_members WHERE exchange_id = ?').bind(x.id),
			locals.db.prepare('DELETE FROM exchanges WHERE id = ?').bind(x.id)
		]);
		redirect(303, '/people');
	},
	reopen: async ({ locals, params }) => {
		const x = await organiser(locals, params.id);
		await locals.db.batch([
			locals.db.prepare('UPDATE exchange_members SET recipient_id = NULL WHERE exchange_id = ?').bind(x.id),
			locals.db.prepare('UPDATE exchanges SET drawn_at = NULL WHERE id = ?').bind(x.id)
		]);
		return { reopened: true };
	}
};
