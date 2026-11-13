import { error } from '@sveltejs/kit';
import { getCategories, getListByToken } from '#lib/server/db.ts';
import { GIVER_COOKIE, NAME_COOKIE, claim, giverItems, unclaim } from '#lib/server/giving.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	const list = await getListByToken(locals.db, params.token);
	if (!list) error(404, 'This list isn’t shared any more.');
	const [items, categories] = await Promise.all([giverItems(locals.db, list.id, cookies.get(GIVER_COOKIE) ?? null), getCategories(locals.db, list.owner_id)]);
	return {
		list: { name: list.name, occasion: list.occasion, occasion_date: list.occasion_date, description: list.description, wrap: list.wrap },
		categories,
		giverName: cookies.get(NAME_COOKIE) ?? '',
		items
	};
};

const inThisList = (db: D1Database, token: string) => (itemId: string) =>
	db
		.prepare('SELECT i.id, i.quantity FROM items i JOIN lists l ON l.id = i.list_id WHERE l.share_token = ? AND i.id = ?')
		.bind(token, itemId)
		.first<{ id: string; quantity: number }>();

export const actions: Actions = {
	claim: ({ request, locals, params, cookies }) => claim(locals.db, request, cookies, inThisList(locals.db, params.token)),
	unclaim: ({ request, locals, params, cookies }) => unclaim(locals.db, request, cookies, inThisList(locals.db, params.token))
};
