import { json } from '@sveltejs/kit';
import { importProduct } from '#lib/server/importer.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { url?: unknown };
	if (typeof body.url !== 'string' || !body.url.trim()) return json({ error: 'Paste a link first.' }, { status: 400 });
	return json(await importProduct(body.url.slice(0, 2000)));
};
