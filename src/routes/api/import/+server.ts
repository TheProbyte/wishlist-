import { json } from '@sveltejs/kit';
import { importAmazonWishlist, importProduct, importWithHint, isAmazonWishlist, normaliseUrl, resolveShortLink, type ImportHint } from '#lib/server/importer.ts';
import { giftKey } from '#lib/format.ts';
import type { RequestHandler } from './$types';

/**
 * Already have it? Looks through every gift you (and your kids) keep for the same product, so
 * pasting a link twice says so instead of adding a second copy.
 */
async function findDuplicate(locals: App.Locals, ...urls: (string | null | undefined)[]) {
	const keys = new Set(urls.map(giftKey).filter((k): k is string => !!k));
	if (!keys.size || !locals.user) return null;
	const { results } = await locals.db
		.prepare(
			`SELECT i.id, i.title, i.url, i.list_id AS master FROM items i JOIN lists l ON l.id = i.list_id
			 WHERE l.owner_id = ? AND l.kind = 'master' AND i.url IS NOT NULL`
		)
		.bind(locals.user.id)
		.all<{ id: string; title: string; url: string; master: string }>();
	const hit = results.find((r) => keys.has(giftKey(r.url) ?? ''));
	return hit ? { id: hit.id, title: hit.title, master: hit.master } : null;
}

/**
 * Read a gift (or a whole Amazon wish list) from a link.
 *   { url }                 - fetch and read the page
 *   { url, hint }           - details the bookmark button already read; fetch only for gaps
 *   { items: [hint, ...] }  - a wish list the bookmark button read
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => ({}))) as { url?: unknown; hint?: ImportHint; items?: ImportHint[] };

	if (Array.isArray(body.items)) {
		const items = await Promise.all(body.items.slice(0, 300).map((h) => importWithHint({ ...h, url: typeof h.url === 'string' ? h.url : undefined }, false)));
		// (Wish lists can be long: each item uses only what the list showed, no extra fetches.)
		return json({ kind: 'wishlist', items });
	}
	if (typeof body.url !== 'string' || !body.url.trim()) return json({ error: 'Paste a link first.' }, { status: 400 });
	// Short links from the Amazon app (a.co/…) only show what they are after following them.
	const raw = await resolveShortLink(body.url.slice(0, 2000));

	const url = normaliseUrl(raw);
	if (url && isAmazonWishlist(url)) {
		const { items, blocked, saw } = await importAmazonWishlist(raw);
		if (items.length) return json({ kind: 'wishlist', items: await Promise.all(items.map((h) => importWithHint(h, false))) });
		const bookmark = 'Open the list in your browser and use the “Add to The Giver” bookmark instead: it reads the list on your screen, so Amazon can’t hide it (set it up on the You page).';
		return json({
			kind: 'wishlist',
			items: [],
			error: blocked
				? `Amazon wouldn’t show that list to our server (it sent ${saw}). ${bookmark}`
				: `Couldn’t find any gifts on that list (Amazon sent ${saw}). If it’s set to Public, Amazon is probably hiding it from servers. ${bookmark}`
		});
	}
	// The duplicate check runs alongside reading the shop's page, so it adds no wait.
	const [gift, early] = await Promise.all([
		body.hint ? importWithHint({ ...body.hint, url: raw }) : importProduct(raw),
		findDuplicate(locals, raw).catch(() => null)
	]);
	const duplicate = early ?? (gift.url && gift.url !== raw ? await findDuplicate(locals, gift.url).catch(() => null) : null);
	return json({ kind: 'gift', ...gift, duplicate });
};
