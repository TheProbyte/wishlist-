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
	{ value: 'birthday', label: 'Birthday', icon: '🎂' },
	{ value: 'christmas', label: 'Christmas', icon: '🎄' },
	{ value: 'wedding', label: 'Wedding', icon: '💍' },
	{ value: 'baby', label: 'Baby', icon: '🍼' },
	{ value: 'anniversary', label: 'Anniversary', icon: '💐' },
	{ value: 'general', label: 'Anytime', icon: '✨' },
	{ value: 'other', label: 'Other', icon: '🎁' }
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
