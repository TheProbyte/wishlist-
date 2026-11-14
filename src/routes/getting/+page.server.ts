import { fail } from '@sveltejs/kit';
import { GIVER_COOKIE } from '#lib/server/giving.ts';
import type { Actions, PageServerLoad } from './$types';

/** Every gift you've said you'll get, whoever it's for: signed in, or from this browser before. */
const mine = (cookies: { get(n: string): string | undefined }, locals: App.Locals) => ({
	userId: locals.authEnabled ? locals.user.id : '',
	token: cookies.get(GIVER_COOKIE) ?? ''
});

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const me = mine(cookies, locals);
	const { results } = await locals.db
		.prepare(
			`SELECT c.id AS claim_id, c.purchased, c.quantity, i.id, i.title, i.image_url, i.price_cents, i.currency, i.url, i.store,
			        u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar, k.name AS kid_name, m.wrap AS paper
			 FROM claims c JOIN items i ON i.id = c.item_id JOIN lists m ON m.id = i.list_id JOIN users u ON u.id = m.owner_id
			 LEFT JOIN kids k ON k.id = m.kid_id
			 WHERE (c.giver_user_id IS NOT NULL AND c.giver_user_id = ?) OR (c.giver_token != '' AND c.giver_token = ?)
			 ORDER BY c.purchased, c.created_at DESC`
		)
		.bind(me.userId, me.token)
		.all<{
			claim_id: string; purchased: number; quantity: number; id: string; title: string; image_url: string | null; price_cents: number | null; currency: string | null;
			url: string | null; store: string | null; owner_id: string; owner_name: string; owner_avatar: string | null; kid_name: string | null; paper: string | null;
		}>();
	return { claims: results };
};

async function ownClaim(db: D1Database, claimId: string, me: { userId: string; token: string }) {
	return db
		.prepare("SELECT id FROM claims WHERE id = ? AND ((giver_user_id IS NOT NULL AND giver_user_id = ?) OR (giver_token != '' AND giver_token = ?))")
		.bind(claimId, me.userId, me.token)
		.first<{ id: string }>();
}

export const actions: Actions = {
	bought: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const claim = await ownClaim(locals.db, String(form.get('claim')), mine(cookies, locals));
		if (!claim) return fail(404, {});
		await locals.db.prepare('UPDATE claims SET purchased = ? WHERE id = ?').bind(form.get('purchased') === '1' ? 1 : 0, claim.id).run();
		return { ok: true };
	},
	release: async ({ request, locals, cookies }) => {
		const claim = await ownClaim(locals.db, String((await request.formData()).get('claim')), mine(cookies, locals));
		if (!claim) return fail(404, {});
		await locals.db.prepare('DELETE FROM claims WHERE id = ?').bind(claim.id).run();
		return { ok: true };
	}
};
