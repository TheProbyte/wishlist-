import { json } from '@sveltejs/kit';
import { importAmazonWishlist, importProduct, importWithHint, isAmazonWishlist, normaliseUrl, type ImportHint } from '#lib/server/importer.ts';
import type { RequestHandler } from './$types';

/**
 * Read a gift (or a whole Amazon wish list) from a link.
 *   { url }                 - fetch and read the page
 *   { url, hint }           - details the bookmark button already read; fetch only for gaps
 *   { items: [hint, ...] }  - a wish list the bookmark button read
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { url?: unknown; hint?: ImportHint; items?: ImportHint[] };

	if (Array.isArray(body.items)) {
		const items = await Promise.all(body.items.slice(0, 300).map((h) => importWithHint({ ...h, url: typeof h.url === 'string' ? h.url : undefined }, false)));
		// (Wish lists can be long: each item uses only what the list showed, no extra fetches.)
		return json({ kind: 'wishlist', items });
	}
	if (typeof body.url !== 'string' || !body.url.trim()) return json({ error: 'Paste a link first.' }, { status: 400 });
	const raw = body.url.slice(0, 2000);

	const url = normaliseUrl(raw);
	if (url && isAmazonWishlist(url)) {
		const { items, blocked } = await importAmazonWishlist(raw);
		if (items.length) return json({ kind: 'wishlist', items: await Promise.all(items.map((h) => importWithHint(h, false))) });
		return json({
			kind: 'wishlist',
			items: [],
			error: blocked
				? 'Amazon wouldn’t show that list to us. Open it in your browser and use the “Add to The Giver” button instead (see the You page).'
				: 'That list looks empty or private. Make sure it’s set to Public or Shared in Amazon.'
		});
	}
	if (body.hint) return json({ kind: 'gift', ...(await importWithHint({ ...body.hint, url: raw })) });
	return json({ kind: 'gift', ...(await importProduct(raw)) });
};
