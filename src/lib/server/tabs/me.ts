import { fail } from '@sveltejs/kit';
import { getKids, safeJson } from '#lib/server/db.ts';
import { SIZE_FIELDS } from '#lib/sizes.ts';
import type { Sizes } from '#lib/types.ts';
import type { RequestEvent } from '@sveltejs/kit';

export const loadMe = async ({ locals }: RequestEvent) => {
	const [me, kids] = await Promise.all([
		locals.db.prepare('SELECT name, email, avatar_url, birthday, sizes FROM users WHERE id = ?').bind(locals.user.id).first<{ name: string; email: string | null; avatar_url: string | null; birthday: string | null; sizes: string }>(),
		getKids(locals.db, locals.user.id)
	]);
	return {
		profile: { name: me?.name ?? 'You', email: me?.email ?? null, avatar_url: me?.avatar_url ?? null, birthday: me?.birthday ?? null, sizes: safeJson<Sizes>(me?.sizes, {}) },
		kids,
		authEnabled: locals.authEnabled
	};
};

function readSizes(form: FormData): string {
	const sizes: Sizes = {};
	for (const f of SIZE_FIELDS) {
		const v = String(form.get(`size_${f.key}`) ?? '').trim().slice(0, 30);
		if (v) sizes[f.key] = v;
	}
	return JSON.stringify(sizes);
}
const dateOrNull = (v: FormDataEntryValue | null) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : null);

export const meActions = {
	saveProfile: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		await locals.db.prepare('UPDATE users SET birthday = ?, sizes = ? WHERE id = ?').bind(dateOrNull(form.get('birthday')), readSizes(form), locals.user.id).run();
		return { profileSaved: true };
	},
	saveKid: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 40);
		if (!name) return fail(400, { kidError: 'What’s their name?' });
		await locals.db
			.prepare('UPDATE kids SET name = ?, birthday = ?, sizes = ? WHERE id = ? AND parent_id = ?')
			.bind(name, dateOrNull(form.get('birthday')), readSizes(form), String(form.get('id')), locals.user.id)
			.run();
		return { kidSaved: true };
	},
	deleteKid: async ({ request, locals }: RequestEvent) => {
		const id = String((await request.formData()).get('id') ?? '');
		// Their lists and gifts go with them.
		await locals.db.prepare('DELETE FROM kids WHERE id = ? AND parent_id = ?').bind(id, locals.user.id).run();
		return { kidDeleted: true };
	}
};

export type MeData = Awaited<ReturnType<typeof loadMe>>;
