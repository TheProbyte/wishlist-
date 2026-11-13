import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { resolveUser } from '#lib/server/auth.ts';
import { ensureSchema } from '#lib/server/schema.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const db = env.DB;
	if (!db) error(500, 'Database binding "DB" is missing. Check wrangler.jsonc.');
	await ensureSchema(db);
	event.locals.db = db;
	event.locals.user = await resolveUser(db);
	return resolve(event);
};
