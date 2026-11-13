import type { Sizes } from './types';

/** The size fields people can save, with examples. */
export const SIZE_FIELDS: { key: keyof Sizes; label: string; example: string }[] = [
	{ key: 'top', label: 'Tops', example: 'M, 10, 40R' },
	{ key: 'bottom', label: 'Pants & jeans', example: '32W × 30L, 8' },
	{ key: 'dress', label: 'Dresses', example: '6, S' },
	{ key: 'shoe', label: 'Shoes', example: 'US 10, EU 43' },
	{ key: 'ring', label: 'Rings', example: '7, N' },
	{ key: 'hat', label: 'Hats', example: '7⅛, L' }
];

const BOTTOMS = /\b(jeans|pants|trousers|shorts|leggings|joggers|sweatpants|chinos|skirt)\b/i;
const DRESSES = /\b(dress|gown|jumpsuit|romper)\b/i;
const HATS = /\b(hat|beanie|cap)\b/i;

/** The saved size that fits a gift, from its category and name. Null if there isn't one. */
export function sizeFor(categoryId: string | null | undefined, title: string, sizes: Sizes): string | null {
	if (categoryId === 'cat_shoes') return sizes.shoe ?? null;
	if (categoryId === 'cat_jewelry') return /\bring\b/i.test(title) ? (sizes.ring ?? null) : null;
	if (categoryId === 'cat_clothes') {
		if (BOTTOMS.test(title)) return sizes.bottom ?? null;
		if (DRESSES.test(title)) return sizes.dress ?? null;
		if (HATS.test(title)) return sizes.hat ?? null;
		return sizes.top ?? null;
	}
	return null;
}
