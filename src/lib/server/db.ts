import type { Category, Item, Kid, List, Sizes, Specific } from '#lib/types.ts';

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

/* ------------------------------------------------------------ the Everything list */

/** Everyone (and every kid) has one Everything list holding all their gifts. */
export const masterId = (personId: string) => `mst_${personId}`;

/** The Everything list a list's gifts live in. */
export const masterOf = (list: Pick<List, 'owner_id' | 'kid_id'>) => masterId(list.kid_id ?? list.owner_id);

export async function ensureMaster(db: D1Database, ownerId: string, kidId: string | null = null) {
	await db
		.prepare("INSERT OR IGNORE INTO lists (id, owner_id, kid_id, name, occasion, kind) VALUES (?, ?, ?, 'Everything', 'general', 'master')")
		.bind(masterId(kidId ?? ownerId), ownerId, kidId)
		.run();
}

/**
 * A list's gifts in its own order. The Everything list holds every gift its owner has
 * (ranked overall); an occasion list holds the gifts placed on it (ranked within it).
 * Each gift also says which occasion lists it is on.
 */
export async function getItems(db: D1Database, list: Pick<List, 'id' | 'kind' | 'owner_id' | 'kid_id'>): Promise<Item[]> {
	const master = list.kind === 'master' ? list.id : masterOf(list);
	const itemsQuery =
		list.kind === 'master'
			? db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY rank, created_at').bind(list.id)
			: db
					.prepare(
						`SELECT i.*, li.rank AS rank FROM list_items li JOIN items i ON i.id = li.item_id
						 WHERE li.list_id = ? ORDER BY li.rank, i.created_at`
					)
					.bind(list.id);
	const [items, specs, links] = await db.batch([
		itemsQuery,
		db
			.prepare(
				`SELECT s.item_id, s.label, s.value FROM item_specifics s
				 JOIN items i ON i.id = s.item_id WHERE i.list_id = ? ORDER BY s.position`
			)
			.bind(master),
		db.prepare('SELECT li.item_id, li.list_id FROM list_items li JOIN items i ON i.id = li.item_id WHERE i.list_id = ?').bind(master)
	]);
	const byItem = new Map<string, Specific[]>();
	for (const s of specs.results as { item_id: string; label: string; value: string }[]) {
		const arr = byItem.get(s.item_id) ?? [];
		arr.push({ label: s.label, value: s.value });
		byItem.set(s.item_id, arr);
	}
	const listsOf = new Map<string, string[]>();
	for (const l of links.results as { item_id: string; list_id: string }[]) {
		const arr = listsOf.get(l.item_id) ?? [];
		arr.push(l.list_id);
		listsOf.set(l.item_id, arr);
	}
	return (items.results as Omit<Item, 'specifics' | 'lists'>[]).map((i) => ({
		...i,
		specifics: byItem.get(i.id) ?? [],
		lists: listsOf.get(i.id) ?? []
	}));
}

/* ------------------------------------------------------------------ people */

type KidRow = Omit<Kid, 'sizes'> & { sizes: string };

export async function getKids(db: D1Database, parentId: string): Promise<Kid[]> {
	const { results } = await db.prepare('SELECT * FROM kids WHERE parent_id = ? ORDER BY created_at').bind(parentId).all<KidRow>();
	return results.map((k) => ({ ...k, sizes: safeJson<Sizes>(k.sizes, {}) }));
}

export async function getKid(db: D1Database, id: string): Promise<Kid | null> {
	const k = await db.prepare('SELECT * FROM kids WHERE id = ?').bind(id).first<KidRow>();
	return k ? { ...k, sizes: safeJson<Sizes>(k.sizes, {}) } : null;
}

/** Sizes for whoever a list belongs to: the kid if it's a kid's list, else the owner. */
export async function sizesFor(db: D1Database, list: Pick<List, 'owner_id' | 'kid_id'>): Promise<Sizes> {
	const row = list.kid_id
		? await db.prepare('SELECT sizes FROM kids WHERE id = ?').bind(list.kid_id).first<{ sizes: string }>()
		: await db.prepare('SELECT sizes FROM users WHERE id = ?').bind(list.owner_id).first<{ sizes: string }>();
	return safeJson<Sizes>(row?.sizes, {});
}

export function safeJson<T>(text: string | null | undefined, fallback: T): T {
	if (!text) return fallback;
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}
