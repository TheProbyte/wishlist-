import { error } from '@sveltejs/kit';
import { getCategories } from '#lib/server/db.ts';
import { GIVER_COOKIE, NAME_COOKIE, claim, giverItems, unclaim } from '#lib/server/giving.ts';
import { orderedLists } from '#lib/server/lists.ts';
import type { Actions, PageServerLoad } from './$types';

async function ownerFor(db: D1Database, token: string) {
	return db.prepare('SELECT id, name FROM users WHERE share_token = ?').bind(token).first<{ id: string; name: string }>();
}

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	const owner = await ownerFor(locals.db, params.token);
	if (!owner) error(404, 'These lists aren’t shared any more.');
	const giver = cookies.get(GIVER_COOKIE) ?? null;
	const [lists, categories] = await Promise.all([orderedLists(locals.db, owner.id), getCategories(locals.db, owner.id)]);
	const withItems = await Promise.all(
		lists.map(async (l) => ({
			id: l.id,
			name: l.name,
			occasion: l.occasion,
			occasion_date: l.occasion_date,
			description: l.description,
			wrap: l.wrap,
			items: await giverItems(locals.db, l.id, giver)
		}))
	);
	return {
		// "You" is the placeholder name until Google sign-in gives people real names.
		ownerName: owner.name && owner.name !== 'You' ? owner.name : null,
		lists: withItems.filter((l) => l.items.length > 0),
		categories,
		giverName: cookies.get(NAME_COOKIE) ?? ''
	};
};

const ownedBy = (db: D1Database, token: string) => (itemId: string) =>
	db
		.prepare(
			`SELECT i.id, i.quantity FROM items i JOIN lists l ON l.id = i.list_id JOIN users u ON u.id = l.owner_id
			 WHERE u.share_token = ? AND i.id = ?`
		)
		.bind(token, itemId)
		.first<{ id: string; quantity: number }>();

export const actions: Actions = {
	claim: ({ request, locals, params, cookies }) => claim(locals.db, request, cookies, ownedBy(locals.db, params.token)),
	unclaim: ({ request, locals, params, cookies }) => unclaim(locals.db, request, cookies, ownedBy(locals.db, params.token))
};
