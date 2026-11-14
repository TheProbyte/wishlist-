import { error, fail, redirect } from '@sveltejs/kit';
import { drawNames, exchangeFor } from '#lib/server/santa.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.authEnabled) error(404, 'Secret Santa needs Google sign-in.');
	const x = await exchangeFor(locals.db, params.id, locals.user.id);
	if (!x) error(404, 'That Secret Santa isn’t one you’re in.');
	const organiser = x.owner_id === locals.user.id;
	const [{ results: members }, recipient, apart] = await Promise.all([
		// Who's in. The organiser also sees who's opened their slip and who has ideas on their
		// wish list (never who has whom).
		locals.db
			.prepare(
				`SELECT u.id, u.name, u.avatar_url, u.sticker, m.seen_at,
				        (SELECT COUNT(*) FROM items i WHERE i.list_id = 'mst_' || u.id) AS gift_count
				 FROM exchange_members m JOIN users u ON u.id = m.user_id WHERE m.exchange_id = ? ORDER BY m.joined_at`
			)
			.bind(x.id)
			.all<{ id: string; name: string; avatar_url: string | null; sticker: string | null; seen_at: number | null; gift_count: number }>(),
		// Only ever your own match: nobody, not even the organiser, sees the others.
		x.recipient_id ? locals.db.prepare('SELECT id, name, avatar_url, sticker FROM users WHERE id = ?').bind(x.recipient_id).first<{ id: string; name: string; avatar_url: string | null; sticker: string | null }>() : null,
		organiser ? locals.db.prepare('SELECT a, b FROM exchange_apart WHERE exchange_id = ?').bind(x.id).all<{ a: string; b: string }>() : null
	]);
	return {
		exchange: { id: x.id, name: x.name, budget_cents: x.budget_cents, currency: x.currency, exchange_date: x.exchange_date, drawn: !!x.drawn_at, invite_token: x.invite_token },
		isOrganiser: organiser,
		members: members.map((m) => ({ id: m.id, name: m.name, avatar_url: m.avatar_url, sticker: m.sticker, ...(organiser ? { seen: !!m.seen_at, gifts: m.gift_count } : {}) })),
		apart: apart?.results ?? [],
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
		const { results: apart } = await locals.db.prepare('SELECT a, b FROM exchange_apart WHERE exchange_id = ?').bind(x.id).all<{ a: string; b: string }>();
		const pairs = drawNames(
			results.map((r) => r.user_id),
			Math.random,
			apart.map((p) => [p.a, p.b] as [string, string])
		);
		if (!pairs) return fail(400, { error: 'With those people kept apart, there’s no way to draw names. Let one pair go and try again.' });
		await locals.db.batch([
			locals.db.prepare('UPDATE exchange_members SET seen_at = NULL WHERE exchange_id = ?').bind(x.id),
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
	/** Keep two people from drawing each other. */
	apart: async ({ request, locals, params }) => {
		const x = await organiser(locals, params.id);
		if (x.drawn_at) return fail(400, { error: 'Names are already drawn.' });
		const form = await request.formData();
		const [a, b] = [String(form.get('a') ?? ''), String(form.get('b') ?? '')].sort();
		if (!a || !b || a === b) return fail(400, { error: 'Pick two different people.' });
		await locals.db.prepare('INSERT OR IGNORE INTO exchange_apart (exchange_id, a, b) VALUES (?, ?, ?)').bind(x.id, a, b).run();
		return { apart: true };
	},
	together: async ({ request, locals, params }) => {
		const x = await organiser(locals, params.id);
		const form = await request.formData();
		await locals.db.prepare('DELETE FROM exchange_apart WHERE exchange_id = ? AND a = ? AND b = ?').bind(x.id, String(form.get('a')), String(form.get('b'))).run();
		return { together: true };
	},
	/** You've opened your slip (so the organiser knows you've seen who you've got). */
	seen: async ({ locals, params }) => {
		const x = await exchangeFor(locals.db, params.id, locals.user.id);
		if (!x?.drawn_at) return { seen: false };
		await locals.db.prepare('UPDATE exchange_members SET seen_at = COALESCE(seen_at, unixepoch()) WHERE exchange_id = ? AND user_id = ?').bind(x.id, locals.user.id).run();
		return { seen: true };
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
