import { fail } from '@sveltejs/kit';
import { getCategories, newId } from '#lib/server/db.ts';
import { isIcon } from '#lib/icons.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [categories, counts] = await Promise.all([
		getCategories(locals.db, locals.user.id),
		locals.db
			.prepare('SELECT i.category_id, COUNT(*) AS n FROM items i JOIN lists l ON l.id = i.list_id WHERE l.owner_id = ? GROUP BY i.category_id')
			.bind(locals.user.id)
			.all<{ category_id: string | null; n: number }>()
	]);
	const byId = new Map(counts.results.map((c) => [c.category_id, c.n]));
	return { categories: categories.map((c) => ({ ...c, count: byId.get(c.id) ?? 0 })) };
};

function readSpecs(raw: FormDataEntryValue | null): string[] {
	return [...new Set(String(raw ?? '').split(',').map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 8);
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim().slice(0, 40);
		const icon = isIcon(String(form.get('icon'))) ? String(form.get('icon')) : 'gift';
		const color = /^#[0-9a-f]{6}$/i.test(String(form.get('color'))) ? String(form.get('color')) : '#C9B79A';
		const specs = JSON.stringify(readSpecs(form.get('specs')));
		if (!name) return fail(400, { error: 'Name the category.' });

		if (id) {
			await locals.db
				.prepare('UPDATE categories SET name = ?, icon = ?, color = ?, suggested_specs = ? WHERE id = ? AND owner_id = ?')
				.bind(name, icon, color, specs, id, locals.user.id)
				.run();
		} else {
			await locals.db
				.prepare('INSERT INTO categories (id, owner_id, name, icon, color, suggested_specs, position) VALUES (?, ?, ?, ?, ?, ?, 100)')
				.bind(newId('cat'), locals.user.id, name, icon, color, specs)
				.run();
		}
		return { saved: true };
	},
	delete: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		await locals.db.prepare('DELETE FROM categories WHERE id = ? AND owner_id = ?').bind(id, locals.user.id).run();
		return { deleted: true };
	}
};
