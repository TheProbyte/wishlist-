/**
 * The signed-in person's colours. Signed in with Google they come with the session (no extra
 * lookup); in single-user mode they're looked up the first time a request needs them.
 */
export async function lookOf(locals: App.Locals): Promise<{ theme: string | null; highlight: string | null } | null> {
	if (locals.look) return locals.look;
	if (!locals.user) return null;
	const row = await locals.db
		.prepare('SELECT theme, highlight FROM users WHERE id = ?')
		.bind(locals.user.id)
		.first<{ theme: string | null; highlight: string | null }>()
		.catch(() => null);
	locals.look = row ?? { theme: null, highlight: null };
	return locals.look;
}
