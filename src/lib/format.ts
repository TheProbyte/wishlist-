import type { Occasion } from './types';

export const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'JPY', 'INR', 'MXN'] as const;

export function formatPrice(cents: number | null | undefined, currency: string | null | undefined): string {
	if (cents == null) return '';
	const cur = currency || 'USD';
	try {
		const zeroDecimal = cur === 'JPY';
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: cur,
			maximumFractionDigits: zeroDecimal ? 0 : 2,
			minimumFractionDigits: zeroDecimal ? 0 : cents % 100 === 0 ? 0 : 2
		}).format(zeroDecimal ? cents / 100 : cents / 100);
	} catch {
		return `${(cents / 100).toFixed(2)} ${cur}`;
	}
}

export function centsToInput(cents: number | null | undefined): string {
	return cents == null ? '' : (cents / 100).toFixed(2).replace(/\.00$/, '');
}

export const OCCASIONS: { value: Occasion; label: string; icon: string }[] = [
	{ value: 'birthday', label: 'Birthday', icon: 'cake' },
	{ value: 'christmas', label: 'Christmas', icon: 'tree' },
	{ value: 'wedding', label: 'Wedding', icon: 'rings' },
	{ value: 'baby', label: 'Baby', icon: 'bottle' },
	{ value: 'anniversary', label: 'Anniversary', icon: 'tulip' },
	{ value: 'general', label: 'Anytime', icon: 'sparkle' },
	{ value: 'other', label: 'Other', icon: 'gift' }
];

export function occasionMeta(o: string) {
	return OCCASIONS.find((x) => x.value === o) ?? OCCASIONS[OCCASIONS.length - 1];
}

/** Days until the date (today = 0). Negative means it has passed. */
export function daysUntil(date: string | null | undefined): number | null {
	if (!date) return null;
	const [y, m, d] = date.split('-').map(Number);
	if (!y || !m || !d) return null;
	const target = new Date(y, m - 1, d);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(date: string | null | undefined): string | null {
	const days = daysUntil(date);
	if (days == null) return null;
	if (days === 0) return 'Today';
	if (days === 1) return 'Tomorrow';
	if (days > 1) return `in ${days} days`;
	if (days === -1) return 'Yesterday';
	return `${-days} days ago`;
}

export function formatDate(date: string | null | undefined): string {
	if (!date) return '';
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ------------------------------------------------------------------ occasion dates */

/**
 * How each occasion's date works:
 *   fixed  - always the same day (Christmas): nothing to enter
 *   yearly - enter it once (a birthday, with the birth year); it rolls to the next one every year
 *   once   - a single date (wedding, baby, other), optional
 *   none   - no date (anytime)
 */
export type DateRule = 'fixed' | 'yearly' | 'once' | 'none';

export function dateRule(occasion: string): DateRule {
	if (occasion === 'christmas') return 'fixed';
	if (occasion === 'birthday' || occasion === 'anniversary') return 'yearly';
	if (occasion === 'general') return 'none';
	return 'once';
}

const pad = (n: number) => String(n).padStart(2, '0');

function isLeap(y: number) {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** The next time month/day comes round, today included. Feb 29 falls on Feb 28 in other years. */
export function nextAnnual(month: number, day: number, now = new Date()): string {
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
		const d = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
		if (new Date(year, month - 1, d) >= today) return `${year}-${pad(month)}-${pad(d)}`;
	}
	return `${now.getFullYear() + 1}-${pad(month)}-${pad(day)}`;
}

/** The date a list is counting down to, whatever was stored. */
export function occasionDate(occasion: string, stored: string | null | undefined, now = new Date()): string | null {
	const rule = dateRule(occasion);
	if (rule === 'fixed') return nextAnnual(12, 25, now);
	if (rule === 'none') return null;
	if (!stored) return null;
	if (rule === 'yearly') {
		const [, m, d] = stored.split('-').map(Number);
		return m && d ? nextAnnual(m, d, now) : null;
	}
	return stored;
}

/** "turns 31" for birthdays, "11 years" for anniversaries, when the stored date has a real year. */
export function milestone(occasion: string, stored: string | null | undefined, now = new Date()): string | null {
	if (dateRule(occasion) !== 'yearly' || !stored) return null;
	const next = occasionDate(occasion, stored, now);
	const years = Number(next?.slice(0, 4)) - Number(stored.slice(0, 4));
	if (!(years > 0 && years < 130)) return null;
	return occasion === 'birthday' ? `turns ${years}` : `${years} ${years === 1 ? 'year' : 'years'}`;
}

/** Name suggested for a new list. Repeating occasions get no year, since the list carries on. */
export function suggestedListName(occasion: string): string {
	const names: Record<string, string> = {
		birthday: 'My birthday',
		christmas: 'Christmas',
		anniversary: 'Our anniversary',
		wedding: 'Wedding',
		baby: 'Baby shower',
		general: 'Wish list',
		other: ''
	};
	return names[occasion] ?? '';
}

/** What to store for a list's date, given the occasion. */
export function storedDate(occasion: string, input: string): string | null {
	const rule = dateRule(occasion);
	if (rule === 'fixed' || rule === 'none') return null;
	return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : null;
}

/* ------------------------------------------------------------------ price drops */

/** Whether to show a "price drop" sticker: it dropped in the last two weeks and is still lower. */
export function hasPriceDrop(i: { price_cents: number | null; prev_price_cents?: number | null; price_dropped_at?: number | null }): boolean {
	return (
		i.prev_price_cents != null &&
		i.price_cents != null &&
		i.price_cents < i.prev_price_cents &&
		!!i.price_dropped_at &&
		Date.now() / 1000 - i.price_dropped_at < 14 * 86400
	);
}

/**
 * A smaller copy of a product photo for grids and rows, where the shop offers one. Amazon photo
 * addresses carry a size code (`._AC_SL1500_`); asking for ~2x the shown size keeps it sharp
 * and a fraction of the download. Other photos are left as they are.
 */
export function thumb(url: string | null | undefined, px: number): string | null | undefined {
	if (!url) return url;
	const m = url.match(/^(https:\/\/[^/]*(?:media-amazon|ssl-images-amazon|images-amazon)\.com\/images\/I\/[^./]+)(?:\.[^/]*?)?\.(jpe?g|png|webp|gif)$/i);
	return m ? `${m[1]}._AC_SL${px}_.${m[2]}` : url;
}
