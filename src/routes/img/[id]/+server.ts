import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Serve an uploaded gift photo. Photos never change, so they can be cached for good. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const row = await locals.db.prepare('SELECT mime, data FROM images WHERE id = ?').bind(params.id).first<{ mime: string; data: string }>();
	if (!row) error(404, 'Photo not found');
	const binary = atob(row.data);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new Response(bytes, { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
};
