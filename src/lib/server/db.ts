import type { Category, Item, List, Specific } from '#lib/types.ts';

export function newId(prefix: string): string {
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	return prefix + '_' + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
}

export function newToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type CategoryRow = Omit<Category, 'suggested_specs'> & { suggested_specs: string };

export async function getCategories(db: D1Database, userId: string): Promise<Category[]> {
	const { results } = await db
		.prepare('SELECT * FROM categories WHERE owner_id IS NULL OR owner_id = ? ORDER BY position, name')
		.bind(userId)
		.all<CategoryRow>();
	return results.map((c) => ({ ...c, suggested_specs: safeJson<string[]>(c.suggested_specs, []) }));
}

export async function getList(db: D1Database, id: string): Promise<List | null> {
	return db.prepare('SELECT * FROM lists WHERE id = ?').bind(id).first<List>();
}

export async function getListByToken(db: D1Database, token: string): Promise<List | null> {
	return db.prepare('SELECT * FROM lists WHERE share_token = ?').bind(token).first<List>();
}

export async function getItems(db: D1Database, listId: string): Promise<Item[]> {
	const [items, specs] = await db.batch([
		db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY rank, created_at').bind(listId),
		db
			.prepare(
				`SELECT s.item_id, s.label, s.value FROM item_specifics s
				 JOIN items i ON i.id = s.item_id WHERE i.list_id = ? ORDER BY s.position`
			)
			.bind(listId)
	]);
	const byItem = new Map<string, Specific[]>();
	for (const s of specs.results as { item_id: string; label: string; value: string }[]) {
		const arr = byItem.get(s.item_id) ?? [];
		arr.push({ label: s.label, value: s.value });
		byItem.set(s.item_id, arr);
	}
	return (items.results as Omit<Item, 'specifics'>[]).map((i) => ({ ...i, specifics: byItem.get(i.id) ?? [] }));
}

export function safeJson<T>(text: string | null | undefined, fallback: T): T {
	if (!text) return fallback;
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}
