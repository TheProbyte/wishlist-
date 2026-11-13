import { error, fail } from '@sveltejs/kit';
import { ensureMaster, getCategories, getKids, masterId, safeJson } from '#lib/server/db.ts';
import { readItemForm } from '#lib/server/items.ts';
import { findDuplicate, saveGift } from '#lib/server/gifts.ts';
import { orderedLists } from '#lib/server/lists.ts';
import type { Sizes } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

/** Who a gift can be for: you, or one of your kids. Each has an Everything list and lists. */
async function scopes(locals: App.Locals) {
	const { db, user } = locals;
	await ensureMaster(db, user.id);
	const [me, lists, kids] = await Promise.all([
		db.prepare('SELECT sizes FROM users WHERE id = ?').bind(user.id).first<{ sizes: string }>(),
		orderedLists(db, user.id),
		getKids(db, user.id)
	]);
	const kidScopes = await Promise.all(
		kids.map(async (k) => {
			await ensureMaster(db, user.id, k.id);
			return { id: k.id, name: k.name, master: masterId(k.id), sizes: k.sizes, lists: (await orderedLists(db, user.id, k.id)).map((l) => ({ id: l.id, name: l.name, occasion: l.occasion })) };
		})
	);
	return [
		{ id: user.id, name: 'Me', master: masterId(user.id), sizes: safeJson<Sizes>(me?.sizes, {}), lists: lists.map((l) => ({ id: l.id, name: l.name, occasion: l.occasion })) },
		...kidScopes
	];
}

export const load: PageServerLoad = async ({ locals }) => ({
	scopes: await scopes(locals),
	categories: await getCategories(locals.db, locals.user.id)
});

/** The Everything list for a scope id, if it's yours or your kid's. */
async function masterFor(locals: App.Locals, scope: string): Promise<string> {
	if (scope === locals.user.id) return masterId(scope);
	const kid = await locals.db.prepare('SELECT id FROM kids WHERE id = ? AND parent_id = ?').bind(scope, locals.user.id).first();
	if (!kid) error(404, 'That list isn’t yours.');
	return masterId(scope);
}

export const actions: Actions = {
	saveItem: async ({ request, locals }) => {
		const form = await request.formData();
		const master = await masterFor(locals, String(form.get('scope') ?? locals.user.id));
		const { item, error: message } = readItemForm(form);
		if (!item) return fail(400, { error: message });
		if (!item.id && form.get('allow_duplicate') !== '1') {
			const dup = await findDuplicate(locals.db, master, item.url, item.title);
			if (dup) return fail(409, { duplicate: { id: dup.id, title: dup.title }, error: null });
		}
		const saved = await saveGift(locals.db, master, item);
		if (typeof saved !== 'string') return fail(404, { error: saved.error });
		return { saved, master };
	},

	/** Add a batch of gifts (an imported wish list). */
	importMany: async ({ request, locals }) => {
		const form = await request.formData();
		const master = await masterFor(locals, String(form.get('scope') ?? locals.user.id));
		const lists = form.getAll('in_list').map(String);
		const gifts = safeJson<{ url: string | null; title: string; image_url: string | null; price_cents: number | null; currency: string | null; store: string | null; category_id: string | null }[]>(String(form.get('items') ?? '[]'), []);
		let added = 0;
		let skipped = 0;
		for (const g of gifts.slice(0, 300)) {
			if (!g.title) continue;
			if (await findDuplicate(locals.db, master, g.url, g.title)) {
				skipped++;
				continue;
			}
			const r = await saveGift(locals.db, master, {
				id: null,
				url: g.url,
				title: String(g.title).slice(0, 200),
				image_url: g.image_url,
				price_cents: typeof g.price_cents === 'number' ? g.price_cents : null,
				currency: g.currency ?? (g.price_cents != null ? 'USD' : null),
				store: g.store,
				category_id: g.category_id,
				rating: 0,
				quantity: 1,
				note: null,
				description: null,
				availability: null,
				specifics: [],
				lists
			});
			if (typeof r === 'string') added++;
		}
		return { imported: added, skipped, master };
	}
};
