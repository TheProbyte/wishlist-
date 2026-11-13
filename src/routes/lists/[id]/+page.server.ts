import { error, fail, redirect } from '@sveltejs/kit';
import { getCategories, getItems, getKid, getList, masterOf, newToken, sizesFor } from '#lib/server/db.ts';
import { readItemForm } from '#lib/server/items.ts';
import { deleteGift, findDuplicate, giftIn, rateGift, removeFromList, reorderGifts, saveGift } from '#lib/server/gifts.ts';
import { refreshStale } from '#lib/server/tracking.ts';
import { isPaper } from '#lib/papers.ts';
import { storedDate } from '#lib/format.ts';
import { orderedLists } from '#lib/server/lists.ts';
import type { Actions, PageServerLoad } from './$types';

async function ownList(locals: App.Locals, id: string) {
	const list = await getList(locals.db, id);
	if (!list || list.owner_id !== locals.user.id) error(404, 'List not found');
	return list;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const list = await ownList(locals, params.id);
	const [items, categories, scopeLists, sizes, kid] = await Promise.all([
		getItems(locals.db, list),
		getCategories(locals.db, locals.user.id),
		orderedLists(locals.db, locals.user.id, list.kid_id),
		sizesFor(locals.db, list),
		list.kid_id ? getKid(locals.db, list.kid_id) : null
	]);
	refreshStale(locals.db, items);

	// For an occasion list: everything else in the Everything list, to pick from.
	const onList = new Set(items.map((i) => i.id));
	const pickable =
		list.kind === 'list'
			? (
					await locals.db
						.prepare('SELECT id, title, image_url, price_cents, currency FROM items WHERE list_id = ? ORDER BY rank, created_at')
						.bind(masterOf(list))
						.all<{ id: string; title: string; image_url: string | null; price_cents: number | null; currency: string | null }>()
				).results.filter((i) => !onList.has(i.id))
			: [];

	// Swiping goes Everything → each occasion list, in the home page's order.
	const order = [masterOf(list), ...scopeLists.map((l) => l.id)];
	const at = order.indexOf(list.id);
	const neighbours = { prev: order[at - 1] ?? null, next: order[at + 1] ?? null };
	return {
		list,
		items,
		categories,
		neighbours,
		sizes,
		pickable,
		kid: kid ? { id: kid.id, name: kid.name } : null,
		// Lists a gift can be put on (for the editor's "On these lists").
		lists: scopeLists.map((l) => ({ id: l.id, name: l.name, occasion: l.occasion }))
	};
};

export const actions: Actions = {
	saveItem: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const form = await request.formData();
		const { item, error: message } = readItemForm(form);
		if (!item) return fail(400, { error: message });
		const master = masterOf(list);

		if (!item.id && form.get('allow_duplicate') !== '1') {
			const dup = await findDuplicate(locals.db, master, item.url, item.title);
			if (dup) return fail(409, { duplicate: { id: dup.id, title: dup.title }, error: null });
		}
		const saved = await saveGift(locals.db, master, item);
		if (typeof saved !== 'string') return fail(404, { error: saved.error });
		return { saved };
	},

	/** Put a gift that's already in the Everything list onto this list too. */
	addExisting: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		if (list.kind !== 'list') return fail(400, { error: 'Pick a list first.' });
		const form = await request.formData();
		const ids = [...new Set([...form.getAll('ids'), form.get('id')].filter(Boolean).map(String))];
		const master = masterOf(list);
		const added: string[] = [];
		for (const id of ids) if (await giftIn(locals.db, master, id)) added.push(id);
		if (!added.length) return fail(404, { error: 'Those gifts no longer exist.' });
		await locals.db.batch([
			...added.map((id) =>
				locals.db
					.prepare('INSERT OR IGNORE INTO list_items (list_id, item_id, rank) VALUES (?, ?, (SELECT COALESCE(MAX(rank), -1) + 1 FROM list_items WHERE list_id = ?))')
					.bind(list.id, id, list.id)
			),
			locals.db.prepare('UPDATE lists SET updated_at = unixepoch() WHERE id = ?').bind(list.id)
		]);
		return { saved: added[0], added: added.length };
	},

	deleteItem: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (form.get('mode') === 'list' && list.kind === 'list') await removeFromList(locals.db, list.id, id);
		else await deleteGift(locals.db, masterOf(list), id);
		return { deleted: id };
	},

	rate: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const form = await request.formData();
		await rateGift(locals.db, masterOf(list), String(form.get('id')), Math.max(0, Math.min(5, Number(form.get('rating')) || 0)));
		return { rated: true };
	},

	reorder: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const ids = String((await request.formData()).get('ids') ?? '')
			.split(',')
			.filter(Boolean)
			.slice(0, 2000);
		if (!ids.length) return fail(400, { error: 'Nothing to reorder.' });
		await reorderGifts(locals.db, list, masterOf(list), ids);
		return { reordered: true };
	},

	updateList: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const form = await request.formData();
		const wrap = String(form.get('wrap') ?? '');
		const description = String(form.get('description') ?? '').trim().slice(0, 500) || null;
		if (list.kind === 'master') {
			// The Everything list keeps its name; its paper and note can change.
			await locals.db
				.prepare('UPDATE lists SET description = ?, wrap = ?, updated_at = unixepoch() WHERE id = ?')
				.bind(description, isPaper(wrap) ? wrap : list.wrap, list.id)
				.run();
			return { listSaved: true };
		}
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { listError: 'Give your list a name.' });
		const occasion = String(form.get('occasion') ?? 'general');
		await locals.db
			.prepare('UPDATE lists SET name = ?, occasion = ?, occasion_date = ?, description = ?, wrap = ?, updated_at = unixepoch() WHERE id = ?')
			.bind(name.slice(0, 80), occasion, storedDate(occasion, String(form.get('occasion_date') ?? '').trim()), description, isPaper(wrap) ? wrap : list.wrap, list.id)
			.run();
		return { listSaved: true };
	},

	deleteList: async ({ locals, params }) => {
		const list = await ownList(locals, params.id);
		if (list.kind === 'master') return fail(400, { listError: 'The Everything list can’t be deleted.' });
		// Gifts stay in the Everything list; only this list goes.
		await locals.db.prepare('DELETE FROM lists WHERE id = ?').bind(list.id).run();
		redirect(303, list.kid_id ? '/' : '/');
	},

	share: async ({ locals, params }) => {
		const list = await ownList(locals, params.id);
		if (!list.share_token) await locals.db.prepare('UPDATE lists SET share_token = ? WHERE id = ?').bind(newToken(), list.id).run();
		return { shared: true };
	},

	unshare: async ({ locals, params }) => {
		const list = await ownList(locals, params.id);
		await locals.db.prepare('UPDATE lists SET share_token = NULL WHERE id = ?').bind(list.id).run();
		return { unshared: true };
	}
};
