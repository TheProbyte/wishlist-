import { error, fail } from '@sveltejs/kit';
import { getCategories, getKids, masterId, safeJson } from '#lib/server/db.ts';
import { readItemForm } from '#lib/server/items.ts';
import { addGiftsBulk, findDuplicate, saveGift } from '#lib/server/gifts.ts';
import { masterListEnsured, orderedLists } from '#lib/server/lists.ts';
import type { Sizes } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

/** Who a gift can be for: you, or one of your kids. Each has an Everything list and lists. */
async function scopes(locals: App.Locals) {
	const { db, user } = locals;
	const [me, lists, kids] = await Promise.all([
		db.prepare('SELECT sizes FROM users WHERE id = ?').bind(user.id).first<{ sizes: string }>(),
		orderedLists(db, user.id),
		getKids(db, user.id)
	]);
	const kidScopes = await Promise.all(
		kids.map(async (k) => {
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
	if (scope === locals.user.id) {
		await masterListEnsured(locals.db, scope);
		return masterId(scope);
	}
	const kid = await locals.db.prepare('SELECT id FROM kids WHERE id = ? AND parent_id = ?').bind(scope, locals.user.id).first();
	if (!kid) error(404, 'That list isn’t yours.');
	await masterListEnsured(locals.db, locals.user.id, scope);
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
		const clean = gifts
			.slice(0, 300)
			.filter((g) => g && typeof g.title === 'string' && g.title.trim())
			.map((g) => ({
				url: typeof g.url === 'string' && /^https?:\/\//.test(g.url) ? g.url : null,
				title: g.title.trim(),
				image_url: typeof g.image_url === 'string' && /^https?:\/\//.test(g.image_url) ? g.image_url : null,
				price_cents: typeof g.price_cents === 'number' ? Math.round(g.price_cents) : null,
				currency: g.currency ?? (typeof g.price_cents === 'number' ? 'USD' : null),
				store: g.store ?? null,
				category_id: g.category_id ?? null
			}));
		const { added, skipped } = await addGiftsBulk(locals.db, master, clean, lists);
		return { imported: added, skipped, master };
	}
};
