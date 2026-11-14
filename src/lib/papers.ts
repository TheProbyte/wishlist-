import type { Occasion } from './types';

/**
 * Wrapping paper: every list wears one (DESIGN.md §3). Drawn with CSS gradients,
 * only ever in the five palette colours.
 */
const COCOA = '#2B1D14';
const CREAM = '#F3E7CF';
const MUSTARD = '#E8A83A';
const RUST = '#D2602D';
const TEAL = '#3E8E87';

export interface Paper {
	id: string;
	name: string;
	background: string;
	ribbon: string;
	/** The bow's inner loop, a shade that reads against the ribbon. */
	bow: string;
}

export const PAPERS: Paper[] = [
	{
		id: 'candy',
		name: 'Candy stripe',
		background: `repeating-linear-gradient(135deg, ${MUSTARD} 0 14px, ${CREAM} 14px 28px)`,
		ribbon: RUST,
		bow: COCOA
	},
	{
		id: 'sunburst',
		name: 'Sunburst',
		background: `repeating-conic-gradient(from -90deg at 0% 100%, ${RUST} 0deg 6deg, ${MUSTARD} 6deg 12deg)`,
		ribbon: TEAL,
		bow: CREAM
	},
	{
		id: 'wide',
		name: 'Wide stripe',
		background: `repeating-linear-gradient(90deg, ${TEAL} 0 26px, ${CREAM} 26px 52px)`,
		ribbon: RUST,
		bow: MUSTARD
	},
	{
		id: 'polka',
		name: 'Polka',
		background: `radial-gradient(circle, ${CREAM} 0 4px, transparent 4.5px) 0 0 / 22px 22px, radial-gradient(circle, ${CREAM} 0 4px, transparent 4.5px) 11px 11px / 22px 22px, ${RUST}`,
		ribbon: MUSTARD,
		bow: COCOA
	},
	{
		id: 'arcs',
		name: 'Rainbow arcs',
		background: `repeating-radial-gradient(circle at 50% 115%, ${RUST} 0 13px, ${MUSTARD} 13px 26px, ${TEAL} 26px 39px, ${CREAM} 39px 52px)`,
		ribbon: COCOA,
		bow: MUSTARD
	},
	{
		id: 'checker',
		name: 'Checker',
		background: `repeating-conic-gradient(${MUSTARD} 0 25%, ${COCOA} 0 50%) 0 0 / 24px 24px`,
		ribbon: RUST,
		bow: CREAM
	},
	{
		id: 'plaid',
		name: 'Plaid',
		background: `repeating-linear-gradient(0deg, rgb(210 96 45 / 0.6) 0 9px, transparent 9px 30px, rgb(243 231 207 / 0.35) 30px 33px, transparent 33px 44px), repeating-linear-gradient(90deg, rgb(210 96 45 / 0.6) 0 9px, transparent 9px 30px, rgb(243 231 207 / 0.35) 30px 33px, transparent 33px 44px), ${TEAL}`,
		ribbon: MUSTARD,
		bow: COCOA
	},
	{
		id: 'confetti',
		name: 'Confetti',
		background: `radial-gradient(circle, ${RUST} 0 3px, transparent 3.5px) 0 0 / 34px 30px, radial-gradient(circle, ${TEAL} 0 3px, transparent 3.5px) 17px 12px / 34px 30px, radial-gradient(circle, ${MUSTARD} 0 3.5px, transparent 4px) 8px 21px / 34px 30px, ${CREAM}`,
		ribbon: TEAL,
		bow: MUSTARD
	},
	{
		id: 'zigzag',
		name: 'Zigzag',
		background: `linear-gradient(135deg, ${MUSTARD} 25%, transparent 25%) -14px 0 / 28px 28px, linear-gradient(225deg, ${MUSTARD} 25%, transparent 25%) -14px 0 / 28px 28px, linear-gradient(315deg, ${MUSTARD} 25%, transparent 25%) 0 0 / 28px 28px, linear-gradient(45deg, ${MUSTARD} 25%, transparent 25%) 0 0 / 28px 28px, ${TEAL}`,
		ribbon: RUST,
		bow: CREAM
	},
	{
		id: 'gingham',
		name: 'Gingham',
		background: `repeating-linear-gradient(0deg, rgb(210 96 45 / 0.45) 0 12px, transparent 12px 24px), repeating-linear-gradient(90deg, rgb(210 96 45 / 0.45) 0 12px, transparent 12px 24px), ${CREAM}`,
		ribbon: TEAL,
		bow: MUSTARD
	},
	{
		id: 'scallop',
		name: 'Scallops',
		background: `radial-gradient(circle at 50% 0, ${MUSTARD} 0 10px, transparent 10.5px) 0 0 / 24px 16px, radial-gradient(circle at 50% 0, ${CREAM} 0 4px, transparent 4.5px) 0 0 / 24px 16px, ${RUST}`,
		ribbon: TEAL,
		bow: CREAM
	},
	{
		id: 'night',
		name: 'Starry night',
		background: `radial-gradient(circle, ${MUSTARD} 0 2.5px, transparent 3px) 0 0 / 40px 36px, radial-gradient(circle, ${CREAM} 0 1.5px, transparent 2px) 20px 18px / 40px 36px, radial-gradient(circle, ${CREAM} 0 1px, transparent 1.5px) 9px 27px / 26px 30px, ${COCOA}`,
		ribbon: MUSTARD,
		bow: RUST
	},
	{
		id: 'diamond',
		name: 'Diamonds',
		background: `linear-gradient(45deg, ${CREAM} 25%, transparent 25%, transparent 75%, ${CREAM} 75%) 0 0 / 26px 26px, linear-gradient(45deg, ${CREAM} 25%, transparent 25%, transparent 75%, ${CREAM} 75%) 13px 13px / 26px 26px, ${MUSTARD}`,
		ribbon: RUST,
		bow: COCOA
	}
];

const BY_OCCASION: Record<Occasion, string> = {
	birthday: 'candy',
	christmas: 'wide',
	wedding: 'arcs',
	baby: 'polka',
	anniversary: 'checker',
	general: 'sunburst',
	other: 'checker'
};

export function paperFor(wrap: string | null | undefined, occasion?: string | null): Paper {
	const id = wrap && PAPERS.some((p) => p.id === wrap) ? wrap : BY_OCCASION[(occasion ?? 'general') as Occasion] ?? 'sunburst';
	return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}

export function defaultPaperId(occasion: string): string {
	return BY_OCCASION[occasion as Occasion] ?? 'sunburst';
}

export function isPaper(id: string | null | undefined): boolean {
	return !!id && PAPERS.some((p) => p.id === id);
}
