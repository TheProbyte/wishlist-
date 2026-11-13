import { daysUntil, nextAnnual, occasionDate } from '#lib/format.ts';

/**
 * Family and friends.
 *
 * Circles are groups of people who can see each other's lists (like a family group). Secret
 * Santa adds one more way to see a list: your match's.
 */

export interface Mate {
	id: string;
	name: string;
	avatar_url: string | null;
	birthday: string | null;
}

/** Everyone who shares at least one circle with this person. */
export async function circleMates(db: D1Database, userId: string): Promise<Mate[]> {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT u.id, u.name, u.avatar_url, u.birthday FROM circle_members me
			 JOIN circle_members them ON them.circle_id = me.circle_id AND them.user_id != me.user_id
			 JOIN users u ON u.id = them.user_id
			 WHERE me.user_id = ? ORDER BY u.name`
		)
		.bind(userId)
		.all<Mate>();
	return results;
}

/** May `viewer` see `target`'s lists? Yes for themselves, circle mates, and their Secret Santa match. */
export async function canView(db: D1Database, viewerId: string, targetId: string): Promise<boolean> {
	if (viewerId === targetId) return true;
	const row = await db
		.prepare(
			`SELECT 1 FROM circle_members a JOIN circle_members b ON b.circle_id = a.circle_id
			 WHERE a.user_id = ? AND b.user_id = ?
			 UNION SELECT 1 FROM exchange_members WHERE user_id = ? AND recipient_id = ? LIMIT 1`
		)
		.bind(viewerId, targetId, viewerId, targetId)
		.first();
	return !!row;
}

export interface Upcoming {
	personId: string;
	name: string;
	avatar_url: string | null;
	/** "Birthday", or the list's name. */
	label: string;
	/** Set when it's a kid's occasion. */
	kid: string | null;
	date: string;
	days: number;
	listId: string | null;
}

/** Occasions coming up for people in your circles: birthdays and their dated lists. */
export async function upcomingInCircles(db: D1Database, userId: string, withinDays: number): Promise<Upcoming[]> {
	const mates = await circleMates(db, userId);
	if (!mates.length) return [];
	const ids = mates.map((m) => m.id);
	const marks = ids.map(() => '?').join(',');
	const { results: lists } = await db
		.prepare(
			`SELECT l.id, l.owner_id, l.name, l.occasion, l.occasion_date, k.name AS kid_name FROM lists l
			 LEFT JOIN kids k ON k.id = l.kid_id
			 WHERE l.owner_id IN (${marks}) AND l.kind = 'list'`
		)
		.bind(...ids)
		.all<{ id: string; owner_id: string; name: string; occasion: string; occasion_date: string | null; kid_name: string | null }>();

	const out: Upcoming[] = [];
	const byId = new Map(mates.map((m) => [m.id, m]));
	for (const l of lists) {
		const date = occasionDate(l.occasion, l.occasion_date);
		const days = daysUntil(date);
		if (date && days != null && days >= 0 && days <= withinDays) {
			const m = byId.get(l.owner_id)!;
			out.push({ personId: m.id, name: m.name, avatar_url: m.avatar_url, label: l.name, kid: l.kid_name, date, days, listId: l.id });
		}
	}
	// Birthdays saved on profiles, unless a birthday list already covers them.
	for (const m of mates) {
		if (!m.birthday || out.some((u) => u.personId === m.id && !u.kid && /birthday/i.test(u.label))) continue;
		const [, mo, d] = m.birthday.split('-').map(Number);
		const date = nextAnnual(mo, d);
		const days = daysUntil(date)!;
		if (days <= withinDays) out.push({ personId: m.id, name: m.name, avatar_url: m.avatar_url, label: 'Birthday', kid: null, date, days, listId: null });
	}
	return out.sort((a, b) => a.days - b.days);
}
