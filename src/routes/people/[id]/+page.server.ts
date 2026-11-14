import { error } from '@sveltejs/kit';
import { daysUntil, occasionDate } from '#lib/format.ts';
import { getCategories, getKids, masterId, safeJson } from '#lib/server/db.ts';
import { GIVER_COOKIE, claim, giverItems, unclaim } from '#lib/server/giving.ts';
import { orderedLists } from '#lib/server/lists.ts';
import { canView } from '#lib/server/people.ts';
import { refreshStale } from '#lib/server/tracking.ts';
import type { List, Sizes } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

/** Someone in your circles (or your Secret Santa match): everything on their lists, to claim from. */
export const load: PageServerLoad = async ({ locals, params, cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!locals.authEnabled) error(404, 'Not found');
	if (params.id === locals.user.id) error(404, 'That’s you! Your own lists are on the Lists tab.');
	if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'You can only see lists of people in your circles.');
	const person = await locals.db.prepare('SELECT id, name, avatar_url, sizes, birthday, sticker, paper FROM users WHERE id = ?').bind(params.id).first<{ id: string; name: string; avatar_url: string | null; sizes: string; birthday: string | null; sticker: string | null; paper: string | null }>();
	if (!person) error(404, 'Not found');

	const giver = { token: cookies.get(GIVER_COOKIE) ?? null, userId: locals.user.id };
	const [lists, kids, categories] = await Promise.all([orderedLists(locals.db, person.id), getKids(locals.db, person.id), getCategories(locals.db, person.id)]);
	const master = (id: string, kidId: string | null): Pick<List, 'id' | 'kind' | 'owner_id' | 'kid_id'> => ({ id: masterId(id), kind: 'master', owner_id: person.id, kid_id: kidId });

	const pages: { id: string; label: string; kid: string | null; occasion: string; occasion_date: string | null; sizes: Sizes; items: Awaited<ReturnType<typeof giverItems>> }[] = [];
	const sizes = safeJson<Sizes>(person.sizes, {});
	pages.push({ id: masterId(person.id), label: 'Everything', kid: null, occasion: 'general', occasion_date: null, sizes, items: await giverItems(locals.db, master(person.id, null), giver) });
	for (const l of lists) pages.push({ id: l.id, label: l.name, kid: null, occasion: l.occasion, occasion_date: l.occasion_date, sizes, items: await giverItems(locals.db, l, giver) });
	for (const k of kids) {
		pages.push({ id: masterId(k.id), label: k.name, kid: k.name, occasion: 'general', occasion_date: null, sizes: k.sizes, items: await giverItems(locals.db, master(k.id, k.id), giver) });
		for (const l of await orderedLists(locals.db, person.id, k.id))
			pages.push({ id: l.id, label: `${k.name}: ${l.name}`, kid: k.name, occasion: l.occasion, occasion_date: l.occasion_date, sizes: k.sizes, items: await giverItems(locals.db, l, giver) });
	}
	refreshStale(locals.db, pages[0].items);
	const wanted = url.searchParams.get('list');

	// Their next occasion (from every list, even empty ones, and their birthday), with how many
	// ideas are on the wish list it belongs to: the page offers to ask them for more if it's thin.
	const candidates = [
		...pages
			.filter((p) => p.occasion !== 'general')
			.map((p) => ({
				label: p.kid ? p.label.slice(p.kid.length + 2) : p.label,
				kid: p.kid,
				date: occasionDate(p.occasion, p.occasion_date),
				gifts: (p.kid ? pages.find((x) => x.kid === p.kid && x.occasion === 'general') : pages[0])?.items.length ?? 0
			})),
		...(person.birthday ? [{ label: 'Birthday', kid: null, date: occasionDate('birthday', person.birthday), gifts: pages[0].items.length }] : [])
	]
		.map((c) => ({ ...c, days: daysUntil(c.date) }))
		.filter((c): c is typeof c & { date: string; days: number } => !!c.date && c.days != null && c.days >= 0)
		.sort((a, b) => a.days - b.days);
	return {
		person: { id: person.id, name: person.name, avatar_url: person.avatar_url, birthday: person.birthday, sticker: person.sticker, paper: person.paper },
		pages: pages.filter((p, i) => i === 0 || p.items.length || p.id === wanted),
		soon: candidates[0] ?? null,
		start: wanted && pages.some((p) => p.id === wanted) ? wanted : pages[0].id,
		categories,
		giverName: locals.user.name
	};
};

/** A gift anywhere on this person's (or their kids') lists. */
const theirs = (db: D1Database, personId: string) => (itemId: string) =>
	db
		.prepare('SELECT i.id, i.quantity, l.owner_id FROM items i JOIN lists l ON l.id = i.list_id WHERE l.owner_id = ? AND l.kind = \'master\' AND i.id = ?')
		.bind(personId, itemId)
		.first<{ id: string; quantity: number; owner_id: string }>();

export const actions: Actions = {
	claim: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return claim(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	},
	unclaim: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return unclaim(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	}
};
