import { fail, redirect } from '@sveltejs/kit';
import { newId, newToken } from '#lib/server/db.ts';
import { GIVER_COOKIE } from '#lib/server/giving.ts';
import { upcomingInCircles } from '#lib/server/people.ts';
import type { RequestEvent } from '@sveltejs/kit';

export const loadPeople = async ({ locals, cookies }: RequestEvent) => {
	if (!locals.authEnabled) return { authEnabled: false as const };
	const { db, user } = locals;
	const [circles, members, exchanges, getting, upcoming] = await Promise.all([
		db
			.prepare('SELECT c.id, c.name, c.owner_id, c.invite_token FROM circles c JOIN circle_members m ON m.circle_id = c.id WHERE m.user_id = ? ORDER BY c.created_at')
			.bind(user.id)
			.all<{ id: string; name: string; owner_id: string; invite_token: string }>(),
		db
			.prepare(
				`SELECT m.circle_id, u.id, u.name, u.avatar_url,
				        (SELECT COUNT(*) FROM items i WHERE i.list_id = 'mst_' || u.id) AS gift_count
				 FROM circle_members m JOIN users u ON u.id = m.user_id
				 WHERE m.circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = ?) ORDER BY m.joined_at`
			)
			.bind(user.id)
			.all<{ circle_id: string; id: string; name: string; avatar_url: string | null; gift_count: number }>(),
		db
			.prepare(
				`SELECT e.id, e.name, e.exchange_date, e.budget_cents, e.currency, e.drawn_at,
				        (SELECT COUNT(*) FROM exchange_members x WHERE x.exchange_id = e.id) AS member_count
				 FROM exchanges e JOIN exchange_members me ON me.exchange_id = e.id WHERE me.user_id = ? ORDER BY e.created_at DESC`
			)
			.bind(user.id)
			.all<{ id: string; name: string; exchange_date: string | null; budget_cents: number | null; currency: string; drawn_at: number | null; member_count: number }>(),
		db
			.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN purchased = 0 THEN 1 ELSE 0 END) AS todo FROM claims WHERE giver_user_id = ? OR giver_token = ?')
			.bind(user.id, cookies.get(GIVER_COOKIE) ?? '')
			.first<{ n: number; todo: number | null }>(),
		upcomingInCircles(db, user.id, 365)
	]);
	// Everyone you share a circle with, once each: who they are, which circles, their next occasion.
	const byId = new Map<string, { id: string; name: string; avatar_url: string | null; gift_count: number; circles: string[]; next: (typeof upcoming)[number] | null }>();
	for (const m of members.results) {
		if (m.id === user.id) continue;
		const circle = circles.results.find((c) => c.id === m.circle_id)?.name ?? '';
		const p = byId.get(m.id) ?? { id: m.id, name: m.name, avatar_url: m.avatar_url, gift_count: m.gift_count, circles: [], next: upcoming.find((u) => u.personId === m.id) ?? null };
		if (circle && !p.circles.includes(circle)) p.circles.push(circle);
		byId.set(m.id, p);
	}
	const people = [...byId.values()].sort((a, b) => (a.next?.days ?? 9999) - (b.next?.days ?? 9999) || a.name.localeCompare(b.name));
	return {
		authEnabled: true as const,
		people,
		circles: circles.results.map((c) => ({ ...c, members: members.results.filter((m) => m.circle_id === c.id) })),
		exchanges: exchanges.results,
		getting: { count: getting?.n ?? 0, todo: getting?.todo ?? 0 },
		upcoming
	};
};

export const peopleActions = {
	createCircle: async ({ request, locals }: RequestEvent) => {
		const name = String((await request.formData()).get('name') ?? '').trim().slice(0, 50);
		if (!name) return fail(400, { circleError: 'Name your circle.' });
		const id = newId('cir');
		await locals.db.batch([
			locals.db.prepare('INSERT INTO circles (id, name, owner_id, invite_token) VALUES (?, ?, ?, ?)').bind(id, name, locals.user.id, newToken()),
			locals.db.prepare('INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)').bind(id, locals.user.id)
		]);
		return { circleCreated: id };
	},
	leaveCircle: async ({ request, locals }: RequestEvent) => {
		const id = String((await request.formData()).get('id') ?? '');
		await locals.db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').bind(id, locals.user.id).run();
		// The last one out turns off the lights.
		await locals.db.prepare('DELETE FROM circles WHERE id = ? AND NOT EXISTS (SELECT 1 FROM circle_members WHERE circle_id = ?)').bind(id, id).run();
		return { left: id };
	},
	createExchange: async ({ request, locals }: RequestEvent) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().slice(0, 60) || 'Secret Santa';
		const budget = Math.round(Number(String(form.get('budget') ?? '').replace(/[^\d.]/g, '')) * 100) || null;
		const date = String(form.get('date') ?? '');
		const id = newId('xch');
		await locals.db.batch([
			locals.db
				.prepare('INSERT INTO exchanges (id, name, owner_id, budget_cents, exchange_date, invite_token) VALUES (?, ?, ?, ?, ?, ?)')
				.bind(id, name, locals.user.id, budget, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, newToken()),
			locals.db.prepare('INSERT INTO exchange_members (exchange_id, user_id) VALUES (?, ?)').bind(id, locals.user.id)
		]);
		redirect(303, `/santa/${id}`);
	}
};

export type PeopleData = Awaited<ReturnType<typeof loadPeople>>;
