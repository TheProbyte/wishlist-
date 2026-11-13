import { error, fail } from '@sveltejs/kit';
import { getCategories, getItems, getListByToken, newId, newToken } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

const GIVER_COOKIE = 'giver';
const NAME_COOKIE = 'giver_name';
const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 400 } as const;

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	const list = await getListByToken(locals.db, params.token);
	if (!list) error(404, 'This list isn’t shared any more.');
	const giver = cookies.get(GIVER_COOKIE) ?? null;

	const [items, categories, claims] = await Promise.all([
		getItems(locals.db, list.id),
		getCategories(locals.db, list.owner_id),
		locals.db
			.prepare(
				`SELECT c.item_id, SUM(c.quantity) AS claimed, SUM(CASE WHEN c.giver_token = ? THEN c.quantity ELSE 0 END) AS mine
				 FROM claims c JOIN items i ON i.id = c.item_id WHERE i.list_id = ? GROUP BY c.item_id`
			)
			.bind(giver ?? '', list.id)
			.all<{ item_id: string; claimed: number; mine: number }>()
	]);
	const byItem = new Map(claims.results.map((c) => [c.item_id, c]));

	return {
		list: { name: list.name, occasion: list.occasion, occasion_date: list.occasion_date, description: list.description, wrap: list.wrap },
		categories,
		giverName: cookies.get(NAME_COOKIE) ?? '',
		items: items.map((i) => ({ ...i, claimed: byItem.get(i.id)?.claimed ?? 0, mine: byItem.get(i.id)?.mine ?? 0 }))
	};
};

async function itemInList(db: D1Database, token: string, itemId: string) {
	return db
		.prepare('SELECT i.id, i.quantity FROM items i JOIN lists l ON l.id = i.list_id WHERE l.share_token = ? AND i.id = ?')
		.bind(token, itemId)
		.first<{ id: string; quantity: number }>();
}

export const actions: Actions = {
	claim: async ({ request, locals, params, cookies }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 40);
		if (!name) return fail(400, { error: 'Add your name so others know it’s taken.' });
		const item = await itemInList(locals.db, params.token, String(form.get('id') ?? ''));
		if (!item) return fail(404, { error: 'That gift has been removed.' });

		const taken = await locals.db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM claims WHERE item_id = ?').bind(item.id).first<{ n: number }>();
		if ((taken?.n ?? 0) >= item.quantity) return fail(409, { error: 'Someone just got that one.' });

		let giver = cookies.get(GIVER_COOKIE);
		if (!giver) {
			giver = newToken();
			cookies.set(GIVER_COOKIE, giver, cookieOpts);
		}
		cookies.set(NAME_COOKIE, name, cookieOpts);
		await locals.db
			.prepare('INSERT INTO claims (id, item_id, giver_token, giver_name, quantity) VALUES (?, ?, ?, ?, 1)')
			.bind(newId('clm'), item.id, giver, name)
			.run();
		return { claimed: item.id };
	},

	unclaim: async ({ request, locals, params, cookies }) => {
		const giver = cookies.get(GIVER_COOKIE);
		const item = await itemInList(locals.db, params.token, String((await request.formData()).get('id') ?? ''));
		if (!giver || !item) return fail(400, { error: 'Nothing to undo.' });
		await locals.db
			.prepare('DELETE FROM claims WHERE id = (SELECT id FROM claims WHERE item_id = ? AND giver_token = ? ORDER BY created_at DESC LIMIT 1)')
			.bind(item.id, giver)
			.run();
		return { unclaimed: item.id };
	}
};
