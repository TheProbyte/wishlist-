import { fail } from '@sveltejs/kit';
import { readSticker } from '#lib/stickers.ts';
import { isPaper } from '#lib/papers.ts';
import { isHighlight, isTheme } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

/** Look & feel: your sticker and paper (what others see), and the app's theme (what you see). */
export const load: PageServerLoad = async ({ locals }) => {
	const me = await locals.db
		.prepare('SELECT name, avatar_url, sticker, paper, theme, highlight FROM users WHERE id = ?')
		.bind(locals.user.id)
		.first<{ name: string; avatar_url: string | null; sticker: string | null; paper: string | null; theme: string | null; highlight: string | null }>();
	return {
		profile: {
			name: me?.name ?? 'You',
			avatar_url: me?.avatar_url ?? null,
			sticker: me?.sticker ?? null,
			paper: me?.paper ?? null,
			theme: isTheme(me?.theme) ? me.theme : 'cocoa',
			highlight: isHighlight(me?.highlight) ? me.highlight : 'auto'
		}
	};
};

export const actions: Actions = {
	saveLook: async ({ request, locals }) => {
		const form = await request.formData();
		const sticker = String(form.get('sticker') ?? '');
		const paper = String(form.get('paper') ?? '');
		await locals.db
			.prepare('UPDATE users SET sticker = ?, paper = ? WHERE id = ?')
			.bind(readSticker(sticker) ? sticker : null, isPaper(paper) ? paper : null, locals.user.id)
			.run();
		return { lookSaved: true };
	},
	saveTheme: async ({ request, locals }) => {
		const form = await request.formData();
		const theme = String(form.get('theme') ?? 'cocoa');
		const highlight = String(form.get('highlight') ?? 'auto');
		if (!isTheme(theme) || !isHighlight(highlight)) return fail(400, { error: 'Pick a theme from the list.' });
		await locals.db.prepare('UPDATE users SET theme = ?, highlight = ? WHERE id = ?').bind(theme === 'cocoa' ? null : theme, highlight === 'auto' ? null : highlight, locals.user.id).run();
		return { themeSaved: true };
	}
};
