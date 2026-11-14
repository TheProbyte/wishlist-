/**
 * Secret Santa: draw names so everyone gives to exactly one other person, nobody gets
 * themselves, and nobody draws someone they're kept apart from (either way round: couples,
 * last year's pairs). Shuffling everyone into one loop and giving to the next person round is
 * tried first (it reads nicely); with pairs kept apart, any fair arrangement will do. Returns
 * null when the pairs kept apart make a draw impossible.
 */
export function drawNames<T>(people: T[], random: () => number = Math.random, apart: [T, T][] = []): Map<T, T> | null {
	const blocked = (a: T, b: T) => apart.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
	const shuffle = (arr: T[]) => {
		const out = [...arr];
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	};
	// One loop round everyone.
	for (let tries = 0; tries < (apart.length ? 400 : 1); tries++) {
		const order = shuffle(people);
		const pairs = new Map(order.map((p, i) => [p, order[(i + 1) % order.length]]));
		if (![...pairs].some(([g, r]) => g === r || blocked(g, r))) return pairs;
	}
	// Any arrangement where nobody has themselves or someone they're kept apart from.
	for (let tries = 0; tries < 4000; tries++) {
		const receivers = shuffle(people);
		if (people.every((g, i) => g !== receivers[i] && !blocked(g, receivers[i]))) return new Map(people.map((g, i) => [g, receivers[i]]));
	}
	return null;
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
