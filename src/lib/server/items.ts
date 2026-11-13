import { CURRENCIES } from '#lib/format.ts';
import type { Specific } from '#lib/types.ts';
import { parsePrice } from './importer';

export interface ItemInput {
	id: string | null;
	url: string | null;
	title: string;
	image_url: string | null;
	price_cents: number | null;
	currency: string | null;
	store: string | null;
	category_id: string | null;
	rating: number;
	quantity: number;
	note: string | null;
	description: string | null;
	availability: string | null;
	specifics: Specific[];
}

const str = (form: FormData, key: string, max = 500): string | null => {
	const v = String(form.get(key) ?? '').trim();
	return v ? v.slice(0, max) : null;
};

const httpUrl = (v: string | null): string | null => {
	if (!v) return null;
	try {
		const u = new URL(v);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
	} catch {
		return null;
	}
};

export function readItemForm(form: FormData): { item?: ItemInput; error?: string } {
	const title = str(form, 'title', 200);
	if (!title) return { error: 'Every gift needs a name.' };

	const priceRaw = str(form, 'price', 40);
	let price_cents: number | null = null;
	if (priceRaw) {
		const p = parsePrice(priceRaw);
		if (!p) return { error: 'That price doesn’t look like a number.' };
		price_cents = p.cents;
	}
	const currency = str(form, 'currency', 3);
	const labels = form.getAll('spec_label').map((v) => String(v).trim());
	const values = form.getAll('spec_value').map((v) => String(v).trim());
	const specifics: Specific[] = [];
	labels.forEach((label, i) => {
		const value = values[i] ?? '';
		if (label && value) specifics.push({ label: label.slice(0, 40), value: value.slice(0, 120) });
	});

	const rating = Math.max(0, Math.min(5, Number(form.get('rating')) || 0));
	const quantity = Math.max(1, Math.min(99, Number(form.get('quantity')) || 1));
	const availability = str(form, 'availability', 20);

	return {
		item: {
			id: str(form, 'id', 40),
			url: httpUrl(str(form, 'url', 2000)),
			title,
			image_url: httpUrl(str(form, 'image_url', 2000)),
			price_cents,
			currency: currency && (CURRENCIES as readonly string[]).includes(currency) ? currency : price_cents != null ? 'USD' : null,
			store: str(form, 'store', 60),
			category_id: str(form, 'category_id', 40),
			rating,
			quantity,
			note: str(form, 'note', 500),
			description: str(form, 'description', 1000),
			availability: availability && ['in_stock', 'out_of_stock', 'unknown'].includes(availability) ? availability : null,
			specifics: specifics.slice(0, 20)
		}
	};
}
