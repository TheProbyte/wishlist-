import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** One of your gifts' full description (the list page only carries the start of long ones). */
export const GET: RequestHandler = async ({ params, locals }) => {
	const row = await locals.db
		.prepare('SELECT i.description FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ? AND l.owner_id = ?')
		.bind(params.id, locals.user.id)
		.first<{ description: string | null }>();
	if (!row) error(404, 'Gift not found');
	return json({ description: row.description }, { headers: { 'cache-control': 'private, no-store' } });
};
