import type { User } from '#lib/types.ts';

/**
 * Temporary single-user mode.
 *
 * Google sign-in is the next step (see PLAN.md). Until then every request acts as one
 * local user, so the app is fully usable for one person. When Google sign-in lands,
 * this function is replaced by a session-cookie lookup and the rest of the app,
 * which only reads `locals.user`, stays as it is.
 */
const LOCAL_USER: User = { id: 'local', name: 'You', email: null, avatar_url: null };
let ensured = false;

export async function resolveUser(db: D1Database): Promise<User> {
	if (!ensured) {
		await db
			.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)')
			.bind(LOCAL_USER.id, LOCAL_USER.name)
			.run();
		ensured = true;
	}
	return LOCAL_USER;
}
