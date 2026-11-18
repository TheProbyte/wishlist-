import { error } from '@sveltejs/kit';
import { later } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

// Natively where the runtime has it (fast); else a byte at a time.
const fromBase64 = (b64: string): Uint8Array => {
	const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
	if (native) return native(b64);
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

/**
 * Serve an uploaded gift photo. Photos never change, so they're cached for good: by the phone
 * (the app keeps each one it's shown), and by Cloudflare's edge when the app has a custom
 * domain (on a workers.dev address Cloudflare doesn't offer that cache, so it's skipped).
 */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	const edge = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
	const hit = await edge?.match(request).catch(() => undefined);
	if (hit) return hit;
	const row = await locals.db.prepare('SELECT mime, data FROM images WHERE id = ?').bind(params.id).first<{ mime: string; data: string }>();
	if (!row) error(404, 'Photo not found');
	const res = new Response(fromBase64(row.data) as Uint8Array<ArrayBuffer>, { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
	if (edge) later(edge.put(request, res.clone()));
	return res;
};
