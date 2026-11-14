import { error, fail } from '@sveltejs/kit';
import { getCategories, getListByToken, masterOf, sizesFor, getKid } from '#lib/server/db.ts';
import { GIVER_COOKIE, NAME_COOKIE, claim, giftInMaster, giverItems, isOwner, unclaim } from '#lib/server/giving.ts';
import { refreshStale } from '#lib/server/tracking.ts';
import { isOwnersDevice } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies, setHeaders }) => {
	// Claims are on this page: never keep a copy in a browser or shared cache.
	setHeaders({ 'cache-control': 'private, no-store' });
	const list = await getListByToken(locals.db, params.token);
	if (!list) error(404, 'This list isn’t shared any more.');
	// Only with real accounts can we tell the owner apart from a giver.
	// Signed in as the owner, or on a device the owner has signed in on (even if signed out now).
	const owner = locals.authEnabled && (isOwner(list, locals.viewer) || (await isOwnersDevice(locals.db, cookies, list.owner_id)));
	const [items, categories, sizes, kid, ownerRow] = await Promise.all([
		giverItems(locals.db, list, { token: cookies.get(GIVER_COOKIE) ?? null, userId: giverAccount(locals)?.id ?? null }, owner),
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
		giverName: cookies.get(NAME_COOKIE) ?? giverAccount(locals)?.name ?? '',
		items
	};
};

/** The giver's account, when accounts exist (in single-user mode everyone is the owner). */
const giverAccount = (locals: App.Locals) => (locals.authEnabled ? locals.viewer : null);

async function findFor(db: D1Database, token: string) {
	const list = await getListByToken(db, token);
	return list ? giftInMaster(db, masterOf(list)) : async () => null;
}

export const actions: Actions = {
	claim: async ({ request, locals, params, cookies }) => {
		// Your own list, on your own device: no claiming (the answer could give a claim away).
		const list = await getListByToken(locals.db, params.token);
		if (list && locals.authEnabled && (isOwner(list, locals.viewer) || (await isOwnersDevice(locals.db, cookies, list.owner_id)))) return fail(400, { error: 'That’s your own list.' });
		return claim(locals.db, request, cookies, giverAccount(locals), await findFor(locals.db, params.token));
	},
	unclaim: async ({ request, locals, params, cookies }) => unclaim(locals.db, request, cookies, giverAccount(locals), await findFor(locals.db, params.token))
};
