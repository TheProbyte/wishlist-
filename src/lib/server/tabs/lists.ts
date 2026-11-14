import { fail, redirect } from '@sveltejs/kit';
import { ensureMaster, getKids, masterId, newId, newToken } from '#lib/server/db.ts';
import { daysUntil, storedDate } from '#lib/format.ts';
import { masterListEnsured, orderedLists } from '#lib/server/lists.ts';
import { upcomingInCircles } from '#lib/server/people.ts';
import { isPaper } from '#lib/papers.ts';
import type { RequestEvent } from '@sveltejs/kit';

export const loadLists = async ({ locals }: RequestEvent) => {
	const { db, user } = locals;
	const [everything, lists, kids, friends, me] = await Promise.all([
		masterListEnsured(db, user.id),
		orderedLists(db, user.id),
		getKids(db, user.id),
		upcomingInCircles(db, user.id, 45),
		db.prepare('SELECT birthday FROM users WHERE id = ?').bind(user.id).first<{ birthday: string | null }>()
	]);

	const kidSections = await Promise.all(
		kids.map(async (kid) => {
			const [master, kidLists] = await Promise.all([masterListEnsured(db, user.id, kid.id), orderedLists(db, user.id, kid.id)]);
			return { kid: { id: kid.id, name: kid.name, birthday: kid.birthday }, everything: master!, lists: kidLists };
		})
	);

	const allLists = [...lists, ...kidSections.flatMap((k) => k.lists)];
	const next = allLists.filter((l) => (daysUntil(l.next_date) ?? -1) >= 0).sort((a, b) => a.next_date!.localeCompare(b.next_date!))[0] ?? null;

	// Gentle nudges: an occasion within a month with only a few gifts on it.
	const reminders = allLists
		.filter((l) => {
			const d = daysUntil(l.next_date);
			return d != null && d >= 0 && d <= 30 && l.item_count < 3;
		})
		.slice(0, 2)
		.map((l) => ({ id: l.id, name: l.name, days: daysUntil(l.next_date)!, count: l.item_count, kid: kidSections.find((k) => k.lists.some((x) => x.id === l.id))?.kid.name ?? null }));

	return { everything: everything!, lists, kids: kidSections, nextId: next?.id ?? null, next, reminders, friends, myBirthday: me?.birthday ?? null };
};

export const listsActions = {
	/** The shelf, arranged by hand: each list's place, in the order given. */
	arrangeLists: async ({ request, locals }: RequestEvent) => {
		const ids = (await request.formData()).getAll('ids').map(String).slice(0, 200);
		if (!ids.length) return { arranged: 0 };
		await locals.db.batch(ids.map((id, i) => locals.db.prepare('UPDATE lists SET position = ? WHERE id = ? AND owner_id = ?').bind(i, id, locals.user.id)));
		return { arranged: ids.length };
	},
	create: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const occasion = String(form.get('occasion') ?? 'general');
		const wrap = String(form.get('wrap') ?? '');
		const kidId = String(form.get('kid_id') ?? '') || null;
		if (!name) return fail(400, { error: 'Give your list a name.' });
		if (kidId) {
			const kid = await locals.db.prepare('SELECT id FROM kids WHERE id = ? AND parent_id = ?').bind(kidId, locals.user.id).first();
			if (!kid) return fail(404, { error: 'That kid isn’t on your account.' });
		}
		const id = newId('lst');
		await locals.db
			.prepare('INSERT INTO lists (id, owner_id, kid_id, name, occasion, occasion_date, wrap) VALUES (?, ?, ?, ?, ?, ?, ?)')
			.bind(id, locals.user.id, kidId, name.slice(0, 80), occasion, storedDate(occasion, String(form.get('occasion_date') ?? '').trim()), isPaper(wrap) ? wrap : null)
			.run();
		redirect(303, `/lists/${id}`);
	},

	addKid: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 40);
		const birthday = String(form.get('birthday') ?? '').trim();
		if (!name) return fail(400, { kidError: 'What’s their name?' });
		const id = newId('kid');
		await locals.db
			.prepare('INSERT INTO kids (id, parent_id, name, birthday) VALUES (?, ?, ?, ?)')
			.bind(id, locals.user.id, name, /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : null)
			.run();
		await ensureMaster(locals.db, locals.user.id, id);
		// A birthday list that rolls on every year, ready to fill.
		if (/^\d{4}-\d{2}-\d{2}$/.test(birthday))
			await locals.db
				.prepare("INSERT INTO lists (id, owner_id, kid_id, name, occasion, occasion_date) VALUES (?, ?, ?, ?, 'birthday', ?)")
				.bind(newId('lst'), locals.user.id, id, `${name}’s birthday`, birthday)
				.run();
		redirect(303, `/lists/${masterId(id)}`);
	},

	/** Share someone's Everything list (yours, or a kid's). */
	shareAll: async ({ request, locals }: RequestEvent) => {
		const id = await ownMaster(locals, request);
		if (!id) return fail(404, {});
		await locals.db.prepare('UPDATE lists SET share_token = COALESCE(share_token, ?) WHERE id = ?').bind(newToken(), id).run();
		return { sharedAll: true };
	},
	unshareAll: async ({ request, locals }: RequestEvent) => {
		const id = await ownMaster(locals, request);
		if (!id) return fail(404, {});
		await locals.db.prepare('UPDATE lists SET share_token = NULL WHERE id = ?').bind(id).run();
		return { unsharedAll: true };
	}
};

async function ownMaster(locals: App.Locals, request: Request): Promise<string | null> {
	const id = String((await request.formData()).get('list') ?? '') || masterId(locals.user.id);
	const row = await locals.db.prepare("SELECT id FROM lists WHERE id = ? AND owner_id = ? AND kind = 'master'").bind(id, locals.user.id).first<{ id: string }>();
	return row?.id ?? null;
}


export type ListsData = Awaited<ReturnType<typeof loadLists>>;
