import type { RequestHandler } from './$types';
import { themeBackground } from '#lib/themes.ts';
import { lookOf } from '#lib/server/look.ts';

/**
 * The installed app's manifest, in your theme. On Android, Chrome colours an installed app's
 * system bars (the status bar and the navigation bar at the bottom) from the manifest's
 * theme_color, not from the page, so a fixed file would keep them brown whatever theme you pick.
 * Chrome re-reads this when the app is opened and updates the installed app in the background.
 *
 * `id` pins the app's identity (it's what the default was), so the colour changing never makes
 * the phone think it's a different app.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const color = themeBackground(locals.user ? (await lookOf(locals))?.theme : null);
	const manifest = {
		id: '/',
		name: 'The Giver',
		short_name: 'The Giver',
		description: 'One wish list for everything you’d love. Share it, and nobody buys the same gift twice.',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: color,
		theme_color: color,
		icons: [
			{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
		],
		share_target: {
			action: '/add',
			method: 'GET',
			enctype: 'application/x-www-form-urlencoded',
			params: { title: 'title', text: 'text', url: 'url' }
		}
	};
	return new Response(JSON.stringify(manifest), {
		headers: { 'content-type': 'application/manifest+json', 'cache-control': 'private, no-cache', vary: 'cookie' }
	});
};
