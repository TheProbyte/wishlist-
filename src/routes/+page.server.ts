import { fail, redirect } from '@sveltejs/kit';
import { newId, newToken } from '#lib/server/db.ts';
import { daysUntil, storedDate } from '#lib/format.ts';
import { orderedLists } from '#lib/server/lists.ts';
import { isPaper } from '#lib/papers.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [lists, me] = await Promise.all([
		orderedLists(locals.db, locals.user.id),
		locals.db.prepare('SELECT share_token FROM users WHERE id = ?').bind(locals.user.id).first<{ share_token: string | null }>()
	]);
	const next = lists.find((l) => (daysUntil(l.next_date) ?? -1) >= 0) ?? null;
	return { lists, nextId: next?.id ?? null, shareAllToken: me?.share_token ?? null };
};

export const actions: Actions = {
	shareAll: async ({ locals }) => {
		await locals.db.prepare('UPDATE users SET share_token = COALESCE(share_token, ?) WHERE id = ?').bind(newToken(), locals.user.id).run();
		return { sharedAll: true };
	},
	unshareAll: async ({ locals }) => {
		await locals.db.prepare('UPDATE users SET share_token = NULL WHERE id = ?').bind(locals.user.id).run();
		return { unsharedAll: true };
	},

	create: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const occasion = String(form.get('occasion') ?? 'general');
		const date = String(form.get('occasion_date') ?? '').trim();
		const wrap = String(form.get('wrap') ?? '');
		if (!name) return fail(400, { error: 'Give your list a name.' });

		const id = newId('lst');
		await locals.db
			.prepare('INSERT INTO lists (id, owner_id, name, occasion, occasion_date, wrap) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(id, locals.user.id, name.slice(0, 80), occasion, storedDate(occasion, date), isPaper(wrap) ? wrap : null)
			.run();
		redirect(303, `/lists/${id}`);
	}
};
