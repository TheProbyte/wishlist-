/**
 * Secret Santa: draw names so everyone gives to exactly one other person and nobody gets
 * themselves. Shuffling the circle and giving to the next person round does both.
 */
export function drawNames<T>(people: T[], random: () => number = Math.random): Map<T, T> {
	const order = [...people];
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return new Map(order.map((p, i) => [p, order[(i + 1) % order.length]]));
}

export async function exchangeFor(db: D1Database, id: string, userId: string) {
	return db
		.prepare(
			`SELECT e.*, me.recipient_id FROM exchanges e JOIN exchange_members me ON me.exchange_id = e.id
			 WHERE e.id = ? AND me.user_id = ?`
		)
		.bind(id, userId)
		.first<{
			id: string; name: string; owner_id: string; budget_cents: number | null; currency: string; exchange_date: string | null;
			invite_token: string; drawn_at: number | null; recipient_id: string | null;
		}>();
}
