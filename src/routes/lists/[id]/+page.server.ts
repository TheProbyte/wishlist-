import { error, fail, redirect } from '@sveltejs/kit';
import { getCategories, getItems, getList, newId, newToken } from '#lib/server/db.ts';
import { readItemForm } from '#lib/server/items.ts';
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
	const [items, categories, all] = await Promise.all([
		getItems(locals.db, list.id),
		getCategories(locals.db, locals.user.id),
		orderedLists(locals.db, locals.user.id)
	]);
	// Neighbours in the home page's order, for swiping between lists.
	const at = all.findIndex((l) => l.id === list.id);
	const neighbours = { prev: all[at - 1]?.id ?? null, next: all[at + 1]?.id ?? null };
	return { list, items, categories, neighbours };
};

const touch = (db: D1Database, listId: string) => db.prepare('UPDATE lists SET updated_at = unixepoch() WHERE id = ?').bind(listId);

export const actions: Actions = {
	saveItem: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const { item, error: message } = readItemForm(await request.formData());
		if (!item) return fail(400, { error: message });
		const db = locals.db;

		let id = item.id;
		const statements: D1PreparedStatement[] = [];
		if (id) {
			const existing = await db
				.prepare('SELECT id, price_cents FROM items WHERE id = ? AND list_id = ?')
				.bind(id, list.id)
				.first<{ id: string; price_cents: number | null }>();
			if (!existing) return fail(404, { error: 'That gift no longer exists.' });
			statements.push(
				db
					.prepare(
						`UPDATE items SET url = ?, title = ?, image_url = ?, price_cents = ?, currency = ?, store = ?, category_id = ?,
						 rating = ?, quantity = ?, note = ?, description = ?, availability = COALESCE(?, availability), updated_at = unixepoch()
						 WHERE id = ?`
					)
					.bind(item.url, item.title, item.image_url, item.price_cents, item.currency, item.store, item.category_id, item.rating, item.quantity, item.note, item.description, item.availability, id)
			);
			if (item.price_cents != null && item.price_cents !== existing.price_cents)
				statements.push(db.prepare('INSERT INTO price_history (item_id, price_cents, currency) VALUES (?, ?, ?)').bind(id, item.price_cents, item.currency));
		} else {
			id = newId('itm');
			const max = await db.prepare('SELECT COALESCE(MAX(rank), -1) AS r FROM items WHERE list_id = ?').bind(list.id).first<{ r: number }>();
			statements.push(
				db
					.prepare(
						`INSERT INTO items (id, list_id, url, title, image_url, price_cents, currency, store, category_id, rating, quantity, note, description, availability, rank, last_checked)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(id, list.id, item.url, item.title, item.image_url, item.price_cents, item.currency, item.store, item.category_id, item.rating, item.quantity, item.note, item.description, item.availability ?? 'unknown', (max?.r ?? -1) + 1, item.url ? Math.floor(Date.now() / 1000) : null)
			);
			if (item.price_cents != null)
				statements.push(db.prepare('INSERT INTO price_history (item_id, price_cents, currency) VALUES (?, ?, ?)').bind(id, item.price_cents, item.currency));
		}

		statements.push(db.prepare('DELETE FROM item_specifics WHERE item_id = ?').bind(id));
		item.specifics.forEach((s, i) =>
			statements.push(db.prepare('INSERT INTO item_specifics (id, item_id, label, value, position) VALUES (?, ?, ?, ?, ?)').bind(newId('spc'), id, s.label, s.value, i))
		);
		statements.push(touch(db, list.id));
		await db.batch(statements);
		return { saved: id };
	},

	deleteItem: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const id = String((await request.formData()).get('id') ?? '');
		await locals.db.batch([locals.db.prepare('DELETE FROM items WHERE id = ? AND list_id = ?').bind(id, list.id), touch(locals.db, list.id)]);
		return { deleted: id };
	},

	rate: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const form = await request.formData();
		const rating = Math.max(0, Math.min(5, Number(form.get('rating')) || 0));
		await locals.db.prepare('UPDATE items SET rating = ?, updated_at = unixepoch() WHERE id = ? AND list_id = ?').bind(rating, String(form.get('id')), list.id).run();
		return { rated: true };
	},

	reorder: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const ids = String((await request.formData()).get('ids') ?? '')
			.split(',')
			.filter(Boolean)
			.slice(0, 1000);
		if (!ids.length) return fail(400, { error: 'Nothing to reorder.' });
		await locals.db.batch([
			...ids.map((id, rank) => locals.db.prepare('UPDATE items SET rank = ? WHERE id = ? AND list_id = ?').bind(rank, id, list.id)),
			touch(locals.db, list.id)
		]);
		return { reordered: true };
	},

	updateList: async ({ request, locals, params }) => {
		const list = await ownList(locals, params.id);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const date = String(form.get('occasion_date') ?? '').trim();
		if (!name) return fail(400, { listError: 'Give your list a name.' });
		await locals.db
			.prepare('UPDATE lists SET name = ?, occasion = ?, occasion_date = ?, description = ?, wrap = ?, updated_at = unixepoch() WHERE id = ?')
			.bind(
				name.slice(0, 80),
				String(form.get('occasion') ?? 'general'),
				storedDate(String(form.get('occasion') ?? 'general'), date),
				String(form.get('description') ?? '').trim().slice(0, 500) || null,
				isPaper(String(form.get('wrap'))) ? String(form.get('wrap')) : list.wrap,
				list.id
			)
			.run();
		return { listSaved: true };
	},

	deleteList: async ({ locals, params }) => {
		const list = await ownList(locals, params.id);
		await locals.db.prepare('DELETE FROM lists WHERE id = ?').bind(list.id).run();
		redirect(303, '/');
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
