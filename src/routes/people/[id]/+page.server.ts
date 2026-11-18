import { error } from '@sveltejs/kit';
import { daysUntil, occasionDate } from '#lib/format.ts';
import { getCategories, getKids, masterId, safeJson } from '#lib/server/db.ts';
import { GIVER_COOKIE, claim, contribute, giverShelf, saveGiverNote, unclaim, uncontribute } from '#lib/server/giving.ts';
import { wholeShelf } from '#lib/server/lists.ts';
import { canView } from '#lib/server/people.ts';
import { refreshStale } from '#lib/server/tracking.ts';
import type { GiverItem, Sizes } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

/** Someone in your circles (or your Secret Santa match): everything on their lists, to claim from. */
export const load: PageServerLoad = async ({ locals, params, cookies, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!locals.authEnabled) error(404, 'Not found');
	if (params.id === locals.user.id) error(404, 'That’s you! Your own lists are on the Lists tab.');
	if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'You can only see lists of people in your circles.');
	const giver = { token: cookies.get(GIVER_COOKIE) ?? null, userId: locals.user.id };
	// Everything at once: who they are, their lists in order, their kids, and every gift with
	// what's claimed (that last one in a single trip, however many lists they have).
	const [person, shelf, kids, categories, gifts] = await Promise.all([
		locals.db.prepare('SELECT id, name, avatar_url, sizes, birthday, sticker, paper FROM users WHERE id = ?').bind(params.id).first<{ id: string; name: string; avatar_url: string | null; sizes: string; birthday: string | null; sticker: string | null; paper: string | null }>(),
		wholeShelf(locals.db, params.id),
		getKids(locals.db, params.id),
		getCategories(locals.db, params.id),
		giverShelf(locals.db, params.id, giver)
	]);
	if (!person) error(404, 'Not found');

	const pages: { id: string; label: string; kid: string | null; occasion: string; occasion_date: string | null; sizes: Sizes; items: GiverItem[] }[] = [];
	const sizes = safeJson<Sizes>(person.sizes, {});
	pages.push({ id: masterId(person.id), label: 'Everything', kid: null, occasion: 'general', occasion_date: null, sizes, items: gifts.master(masterId(person.id)) });
	for (const l of shelf.lists()) pages.push({ id: l.id, label: l.name, kid: null, occasion: l.occasion, occasion_date: l.occasion_date, sizes, items: gifts.list(l.id) });
	for (const k of kids) {
		pages.push({ id: masterId(k.id), label: k.name, kid: k.name, occasion: 'general', occasion_date: null, sizes: k.sizes, items: gifts.master(masterId(k.id)) });
		for (const l of shelf.lists(k.id)) pages.push({ id: l.id, label: `${k.name}: ${l.name}`, kid: k.name, occasion: l.occasion, occasion_date: l.occasion_date, sizes: k.sizes, items: gifts.list(l.id) });
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
		.prepare('SELECT i.id, i.quantity, i.price_cents, l.owner_id FROM items i JOIN lists l ON l.id = i.list_id WHERE l.owner_id = ? AND l.kind = \'master\' AND i.id = ?')
		.bind(personId, itemId)
		.first<{ id: string; quantity: number; owner_id: string; price_cents: number | null }>();

export const actions: Actions = {
	claim: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return claim(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	},
	unclaim: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return unclaim(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	},
	contribute: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return contribute(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	},
	uncontribute: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return uncontribute(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	},
	note: async ({ request, locals, params, cookies }) => {
		if (!(await canView(locals.db, locals.user.id, params.id))) error(404, 'Not found');
		return saveGiverNote(locals.db, request, cookies, locals.user, theirs(locals.db, params.id));
	}
};
