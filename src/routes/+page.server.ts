import { fail, redirect } from '@sveltejs/kit';
import { newId } from '#lib/server/db.ts';
import { daysUntil } from '#lib/format.ts';
import type { List } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

type ListRow = List & { item_count: number };

export const load: PageServerLoad = async ({ locals }) => {
	const { db, user } = locals;
	const [lists, images] = await db.batch([
		db
			.prepare(
				`SELECT l.*, (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count
				 FROM lists l WHERE l.owner_id = ? ORDER BY l.updated_at DESC`
			)
			.bind(user.id),
		db
			.prepare(
				`SELECT i.list_id, i.image_url FROM items i JOIN lists l ON l.id = i.list_id
				 WHERE l.owner_id = ? AND i.image_url IS NOT NULL ORDER BY i.rank, i.created_at`
			)
			.bind(user.id)
	]);

	const covers = new Map<string, string[]>();
	for (const row of images.results as { list_id: string; image_url: string }[]) {
		const arr = covers.get(row.list_id) ?? [];
		if (arr.length < 4) arr.push(row.image_url);
		covers.set(row.list_id, arr);
	}

	// Upcoming occasions first (soonest at the top), then undated lists, then past ones.
	const bucket = (l: ListRow) => {
		const d = daysUntil(l.occasion_date);
		return d == null ? 1 : d >= 0 ? 0 : 2;
	};
	const sorted = (lists.results as ListRow[]).sort((a, b) => {
		const ba = bucket(a);
		const bb = bucket(b);
		if (ba !== bb) return ba - bb;
		if (ba === 0) return (a.occasion_date ?? '').localeCompare(b.occasion_date ?? '');
		return b.updated_at - a.updated_at;
	});

	return { lists: sorted.map((l) => ({ ...l, covers: covers.get(l.id) ?? [] })) };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const occasion = String(form.get('occasion') ?? 'general');
		const date = String(form.get('occasion_date') ?? '').trim();
		if (!name) return fail(400, { error: 'Give your list a name.' });
		if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, { error: 'That date doesn’t look right.' });

		const id = newId('lst');
		await locals.db
			.prepare('INSERT INTO lists (id, owner_id, name, occasion, occasion_date) VALUES (?, ?, ?, ?, ?)')
			.bind(id, locals.user.id, name.slice(0, 80), occasion, date || null)
			.run();
		redirect(303, `/lists/${id}`);
	}
};
