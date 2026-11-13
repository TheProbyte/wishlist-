import { error } from '@sveltejs/kit';
import { getCategories, getListByToken, masterOf, sizesFor, getKid } from '#lib/server/db.ts';
import { GIVER_COOKIE, NAME_COOKIE, claim, giftInMaster, giverItems, isOwner, unclaim } from '#lib/server/giving.ts';
import { refreshStale } from '#lib/server/tracking.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	const list = await getListByToken(locals.db, params.token);
	if (!list) error(404, 'This list isn’t shared any more.');
	const owner = isOwner(list, locals.viewer);
	const [items, categories, sizes, kid, ownerRow] = await Promise.all([
		giverItems(locals.db, list, { token: cookies.get(GIVER_COOKIE) ?? null, userId: locals.viewer?.id ?? null }, owner),
		getCategories(locals.db, list.owner_id),
		sizesFor(locals.db, list),
		list.kid_id ? getKid(locals.db, list.kid_id) : null,
		locals.db.prepare('SELECT name FROM users WHERE id = ?').bind(list.owner_id).first<{ name: string }>()
	]);
	refreshStale(locals.db, items);
	const ownerName = ownerRow?.name && ownerRow.name !== 'You' ? ownerRow.name : null;
	return {
		list: { name: list.name, kind: list.kind, occasion: list.occasion, occasion_date: list.occasion_date, description: list.description, wrap: list.wrap },
		// Whose list this is, for the heading ("Maya’s wish list").
		person: kid ? kid.name : ownerName,
		categories,
		sizes,
		isOwner: owner,
		giverName: cookies.get(NAME_COOKIE) ?? locals.viewer?.name ?? '',
		items
	};
};

async function findFor(db: D1Database, token: string) {
	const list = await getListByToken(db, token);
	return list ? giftInMaster(db, masterOf(list)) : async () => null;
}

export const actions: Actions = {
	claim: async ({ request, locals, params, cookies }) => claim(locals.db, request, cookies, locals.viewer, await findFor(locals.db, params.token)),
	unclaim: async ({ request, locals, params, cookies }) => unclaim(locals.db, request, cookies, locals.viewer, await findFor(locals.db, params.token))
};
