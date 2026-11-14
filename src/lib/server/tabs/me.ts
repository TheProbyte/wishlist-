import { readSticker } from '#lib/stickers.ts';
import { isPaper } from '#lib/papers.ts';
import { fail } from '@sveltejs/kit';
import { getKids, safeJson } from '#lib/server/db.ts';
import { SIZE_FIELDS } from '#lib/sizes.ts';
import type { Sizes } from '#lib/types.ts';
import type { RequestEvent } from '@sveltejs/kit';

export const loadMe = async ({ locals }: RequestEvent) => {
	const [me, kids] = await Promise.all([
		locals.db.prepare('SELECT name, email, avatar_url, birthday, sizes, sticker, paper FROM users WHERE id = ?').bind(locals.user.id).first<{ name: string; email: string | null; avatar_url: string | null; birthday: string | null; sizes: string; sticker: string | null; paper: string | null }>(),
		getKids(locals.db, locals.user.id)
	]);
	return {
		profile: { name: me?.name ?? 'You', email: me?.email ?? null, avatar_url: me?.avatar_url ?? null, birthday: me?.birthday ?? null, sizes: safeJson<Sizes>(me?.sizes, {}), sticker: me?.sticker ?? null, paper: me?.paper ?? null },
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
	/** Your sticker (instead of your photo) and your signature wrapping paper. */
	saveLook: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const sticker = String(form.get('sticker') ?? '');
		const paper = String(form.get('paper') ?? '');
		await locals.db
			.prepare('UPDATE users SET sticker = ?, paper = ? WHERE id = ?')
			.bind(readSticker(sticker) ? sticker : null, isPaper(paper) ? paper : null, locals.user.id)
			.run();
		return { lookSaved: true };
	},
	saveProfile: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const birthday = dateOrNull(form.get('birthday'));
		const before = await locals.db.prepare('SELECT birthday FROM users WHERE id = ?').bind(locals.user.id).first<{ birthday: string | null }>();
		await locals.db.batch([
			locals.db.prepare('UPDATE users SET birthday = ?, sizes = ? WHERE id = ?').bind(birthday, readSizes(form), locals.user.id),
			// Birthday lists that were using the old birthday (or none) follow the new one.
			...(birthday
				? [
						locals.db
							.prepare(`UPDATE lists SET occasion_date = ? WHERE owner_id = ? AND kid_id IS NULL AND occasion = 'birthday' AND (occasion_date IS NULL OR occasion_date = ?)`)
							.bind(birthday, locals.user.id, before?.birthday ?? '')
					]
				: [])
		]);
		return { profileSaved: true };
	},
	saveKid: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 40);
		if (!name) return fail(400, { kidError: 'What’s their name?' });
		const id = String(form.get('id'));
		const birthday = dateOrNull(form.get('birthday'));
		const before = await locals.db.prepare('SELECT birthday FROM kids WHERE id = ? AND parent_id = ?').bind(id, locals.user.id).first<{ birthday: string | null }>();
		if (!before) return fail(404, { kidError: 'Couldn’t find them.' });
		await locals.db.batch([
			locals.db.prepare('UPDATE kids SET name = ?, birthday = ?, sizes = ? WHERE id = ? AND parent_id = ?').bind(name, birthday, readSizes(form), id, locals.user.id),
			...(birthday
				? [
						locals.db
							.prepare(`UPDATE lists SET occasion_date = ? WHERE owner_id = ? AND kid_id = ? AND occasion = 'birthday' AND (occasion_date IS NULL OR occasion_date = ?)`)
							.bind(birthday, locals.user.id, id, before.birthday ?? '')
					]
				: [])
		]);
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
