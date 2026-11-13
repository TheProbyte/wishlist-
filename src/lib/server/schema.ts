/**
 * Applies any database migrations in /migrations that haven't run yet.
 *
 * The Cloudflare deploy command may be plain `wrangler deploy`, which never runs
 * `wrangler d1 migrations apply`, so the app does it itself on its first request.
 * It records each migration in the same `d1_migrations` table Wrangler uses, so
 * either route works and neither re-runs what the other applied.
 */
const files = import.meta.glob('../../../migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const MIGRATIONS = Object.entries(files)
	.map(([path, sql]) => ({ name: path.split('/').pop()!, sql }))
	.sort((a, b) => a.name.localeCompare(b.name));

// Statements that fail only because a concurrent request already applied them.
const ALREADY_DONE = /duplicate column name|already exists/i;

let ready: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
	ready ??= migrate(db).catch((e) => {
		ready = null; // try again on the next request
		throw e;
	});
	return ready;
}

async function migrate(db: D1Database) {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS d1_migrations(
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT UNIQUE,
				applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
			)`
		)
		.run();
	const { results } = await db.prepare('SELECT name FROM d1_migrations').all<{ name: string }>();
	const applied = new Set(results.map((r) => r.name));

	for (const m of MIGRATIONS) {
		if (applied.has(m.name)) continue;
		for (const statement of splitSql(m.sql)) {
			try {
				await db.prepare(statement).run();
			} catch (e) {
				if (!ALREADY_DONE.test(String((e as Error)?.message ?? e))) throw e;
			}
		}
		await db.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind(m.name).run();
	}
}

/** Migrations here are plain DDL/DML with no semicolons inside strings. */
function splitSql(sql: string): string[] {
	return sql
		.replace(/--.*$/gm, '')
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean);
}
