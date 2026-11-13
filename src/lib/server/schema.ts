import initSql from '../../../migrations/0001_init.sql?raw';

/**
 * Creates the tables on a brand-new database, so the site works even when the
 * deploy step didn't run `wrangler d1 migrations apply`. The SQL is the same file
 * as the first migration and is safe to run twice.
 */
let ready: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
	ready ??= (async () => {
		const found = await db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
		if (found) return;
		const statements = initSql
			.replace(/--.*$/gm, '')
			.split(';')
			.map((s) => s.trim())
			.filter(Boolean);
		await db.batch(statements.map((s) => db.prepare(s)));
	})().catch((e) => {
		ready = null; // try again on the next request
		throw e;
	});
	return ready;
}
