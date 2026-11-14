import { fail } from '@sveltejs/kit';
import { GIVER_COOKIE } from '#lib/server/giving.ts';
import { upcomingInCircles } from '#lib/server/people.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * Your shopping list: every gift you've said you'll get (or are chipping in on), whoever it's
 * for, grouped by person and their next occasion, each one claimed → ordered → wrapped.
 * Signed in, or from this browser before signing in.
 */
const mine = (cookies: { get(n: string): string | undefined }, locals: App.Locals) => ({
	userId: locals.authEnabled ? locals.user.id : '',
	token: cookies.get(GIVER_COOKIE) ?? ''
});
const WHO = `((x.giver_user_id IS NOT NULL AND x.giver_user_id = ?) OR (x.giver_token != '' AND x.giver_token = ?))`;
const GIFT = `i.id, i.title, i.image_url, i.price_cents, i.currency, i.url, i.store,
	u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar, u.sticker AS owner_sticker, k.name AS kid_name,
	COALESCE(CASE WHEN m.kid_id IS NULL THEN u.paper END, m.wrap) AS paper
	FROM items i JOIN lists m ON m.id = i.list_id JOIN users u ON u.id = m.owner_id LEFT JOIN kids k ON k.id = m.kid_id`;

type Gift = {
	id: string; title: string; image_url: string | null; price_cents: number | null; currency: string | null; url: string | null; store: string | null;
	owner_id: string; owner_name: string; owner_avatar: string | null; owner_sticker: string | null; kid_name: string | null; paper: string | null;
};

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const me = mine(cookies, locals);
	const [claims, chips, upcoming] = await Promise.all([
		locals.db
			.prepare(`SELECT x.id AS claim_id, x.purchased, x.wrapped, x.quantity, x.note, ${GIFT.replace('FROM items i', 'FROM claims x JOIN items i ON i.id = x.item_id')} WHERE ${WHO} ORDER BY x.created_at DESC`)
			.bind(me.userId, me.token)
			.all<Gift & { claim_id: string; purchased: number; wrapped: number; quantity: number; note: string | null }>(),
		locals.db
			.prepare(
				`SELECT x.id AS chip_id, x.amount_cents, x.note, (SELECT SUM(amount_cents) FROM contributions y WHERE y.item_id = i.id) AS covered,
				        ${GIFT.replace('FROM items i', 'FROM contributions x JOIN items i ON i.id = x.item_id')} WHERE ${WHO} ORDER BY x.created_at DESC`
			)
			.bind(me.userId, me.token)
			.all<Gift & { chip_id: string; amount_cents: number; note: string | null; covered: number }>(),
		locals.authEnabled ? upcomingInCircles(locals.db, locals.user.id, 365) : Promise.resolve([])
	]);
	// Each person's (or kid's) next occasion, so the soonest come first and close ones are flagged.
	const nextFor = (ownerId: string, kid: string | null) => upcoming.find((u) => u.personId === ownerId && (u.kid ?? null) === kid) ?? null;
	return {
		claims: claims.results.map((c) => ({ ...c, next: nextFor(c.owner_id, c.kid_name) })),
		chips: chips.results.map((c) => ({ ...c, next: nextFor(c.owner_id, c.kid_name) }))
	};
};

async function own(db: D1Database, table: 'claims' | 'contributions', id: string, me: { userId: string; token: string }) {
	return db.prepare(`SELECT x.id FROM ${table} x WHERE x.id = ? AND ${WHO}`).bind(id, me.userId, me.token).first<{ id: string }>();
}

export const actions: Actions = {
	/** Where a gift is up to: 0 claimed, 1 ordered, 2 wrapped. */
	stage: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const claim = await own(locals.db, 'claims', String(form.get('claim')), mine(cookies, locals));
		if (!claim) return fail(404, {});
		const stage = Math.max(0, Math.min(2, Number(form.get('stage')) || 0));
		await locals.db.prepare('UPDATE claims SET purchased = ?, wrapped = ? WHERE id = ?').bind(stage >= 1 ? 1 : 0, stage >= 2 ? 1 : 0, claim.id).run();
		return { ok: true };
	},
	/** Older pages still send this: bought or not. */
	bought: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const claim = await own(locals.db, 'claims', String(form.get('claim')), mine(cookies, locals));
		if (!claim) return fail(404, {});
		await locals.db.prepare('UPDATE claims SET purchased = ? WHERE id = ?').bind(form.get('purchased') === '1' ? 1 : 0, claim.id).run();
		return { ok: true };
	},
	note: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const table = form.get('kind') === 'chip' ? 'contributions' : 'claims';
		const row = await own(locals.db, table, String(form.get('id')), mine(cookies, locals));
		if (!row) return fail(404, {});
		await locals.db.prepare(`UPDATE ${table} SET note = ? WHERE id = ?`).bind(String(form.get('note') ?? '').trim().slice(0, 200) || null, row.id).run();
		return { ok: true };
	},
	release: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const table = form.get('kind') === 'chip' ? 'contributions' : 'claims';
		const row = await own(locals.db, table, String(form.get('claim') ?? form.get('id')), mine(cookies, locals));
		if (!row) return fail(404, {});
		await locals.db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(row.id).run();
		return { ok: true };
	}
};
