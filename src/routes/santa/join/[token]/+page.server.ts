import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function exchangeByToken(db: D1Database, token: string) {
	const x = await db
		.prepare('SELECT e.id, e.name, e.drawn_at, e.budget_cents, e.currency, e.exchange_date, u.name AS organiser FROM exchanges e JOIN users u ON u.id = e.owner_id WHERE e.invite_token = ?')
		.bind(token)
		.first<{ id: string; name: string; drawn_at: number | null; budget_cents: number | null; currency: string; exchange_date: string | null; organiser: string }>();
	if (!x) error(404, 'That invite link doesn’t work any more.');
	return x;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.authEnabled) error(400, 'Secret Santa needs Google sign-in, which isn’t switched on yet.');
	const x = await exchangeByToken(locals.db, params.token);
	const member = await locals.db.prepare('SELECT 1 FROM exchange_members WHERE exchange_id = ? AND user_id = ?').bind(x.id, locals.user.id).first();
	if (member) redirect(303, `/santa/${x.id}`);
	const { results } = await locals.db
		.prepare('SELECT u.name, u.avatar_url FROM exchange_members m JOIN users u ON u.id = m.user_id WHERE m.exchange_id = ?')
		.bind(x.id)
		.all<{ name: string; avatar_url: string | null }>();
	return { exchange: x, members: results };
};

export const actions: Actions = {
	default: async ({ locals, params }) => {
		const x = await exchangeByToken(locals.db, params.token);
		if (x.drawn_at) error(400, 'Names have already been drawn for this one.');
		await locals.db.prepare('INSERT OR IGNORE INTO exchange_members (exchange_id, user_id) VALUES (?, ?)').bind(x.id, locals.user.id).run();
		redirect(303, `/santa/${x.id}`);
	}
};
