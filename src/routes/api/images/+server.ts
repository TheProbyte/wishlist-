import { error, json } from '@sveltejs/kit';
import { newId } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 1_200_000;

/** Store a photo someone took of a gift. The browser has already shrunk it. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const type = (request.headers.get('content-type') ?? '').split(';')[0].trim();
	if (!TYPES.includes(type)) error(415, 'Photos only, please (JPEG, PNG or WebP).');
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (!bytes.length) error(400, 'That photo was empty.');
	if (bytes.length > MAX_BYTES) error(413, 'That photo is too big.');
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	const id = newId('img');
	await locals.db.prepare('INSERT INTO images (id, owner_id, mime, data) VALUES (?, ?, ?, ?)').bind(id, locals.user.id, type, btoa(binary)).run();
	return json({ url: `/img/${id}` });
};
