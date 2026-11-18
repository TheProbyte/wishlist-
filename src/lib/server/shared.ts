import { getKids, safeJson } from '#lib/server/db.ts';
import { upcomingInCircles } from '#lib/server/people.ts';
import type { Sizes } from '#lib/types.ts';

/**
 * Lookups the loaders of one request share. The home page loads all three tabs at once and
 * several of them want the same rows (your kids, your profile, who has something coming up), so
 * each is looked up once per request, whichever tab asks first.
 */
const memos = new WeakMap<App.Locals, Map<string, Promise<unknown>>>();

function once<T>(locals: App.Locals, key: string, work: () => Promise<T>): Promise<T> {
	let memo = memos.get(locals);
	if (!memo) memos.set(locals, (memo = new Map()));
	if (!memo.has(key)) memo.set(key, work());
	return memo.get(key) as Promise<T>;
}

export const myKids = (locals: App.Locals) => once(locals, 'kids', () => getKids(locals.db, locals.user.id));

/** Occasions in your circles over the next year (the Lists tab shows the next 45 days of it). */
export const comingUp = (locals: App.Locals) => once(locals, 'upcoming', () => upcomingInCircles(locals.db, locals.user.id, 365));

export const myProfile = (locals: App.Locals) =>
	once(locals, 'profile', async () => {
		const me = await locals.db
			.prepare('SELECT name, email, avatar_url, birthday, sizes, sticker, paper FROM users WHERE id = ?')
			.bind(locals.user.id)
			.first<{ name: string; email: string | null; avatar_url: string | null; birthday: string | null; sizes: string; sticker: string | null; paper: string | null }>();
		return {
			name: me?.name ?? 'You',
			email: me?.email ?? null,
			avatar_url: me?.avatar_url ?? null,
			birthday: me?.birthday ?? null,
			sizes: safeJson<Sizes>(me?.sizes, {}),
			sticker: me?.sticker ?? null,
			paper: me?.paper ?? null
		};
	});
