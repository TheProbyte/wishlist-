/**
 * Motion helpers (DESIGN.md §5–6). Everything here respects "reduce motion".
 */

export function prefersReducedMotion(): boolean {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Transition duration, or 0 when the person has asked for less motion. */
export function dur(ms: number): number {
	return prefersReducedMotion() ? 0 : ms;
}

/* ------------------------------------------------------------- page transitions */

export type NavDirection = 'next' | 'prev' | 'open' | 'close' | 'fade';

let pending: NavDirection | null = null;

/** Set by a swipe or a prev/next button just before navigating, so the page slides the right way. */
export function setNavDirection(d: NavDirection) {
	pending = d;
}

export const TABS = [
	{ href: '/', label: 'Lists', icon: 'gift' },
	{ href: '/upcoming', label: 'Coming up', icon: 'calendar' },
	{ href: '/categories', label: 'Categories', icon: 'tag' }
] as const;

export function tabIndex(path: string): number {
	if (path === '/' || path.startsWith('/lists')) return 0;
	if (path.startsWith('/upcoming')) return 1;
	if (path.startsWith('/categories')) return 2;
	return -1;
}

const isTabRoot = (path: string) => TABS.some((t) => t.href === path);

export function navDirection(from: string, to: string): NavDirection {
	if (pending) {
		const d = pending;
		pending = null;
		return d;
	}
	const a = tabIndex(from);
	const b = tabIndex(to);
	if (isTabRoot(from) && to.startsWith('/lists/')) return 'open';
	if (from.startsWith('/lists/') && isTabRoot(to)) return a === b ? 'close' : b > a ? 'next' : 'prev';
	if (a >= 0 && b >= 0 && a !== b) return b > a ? 'next' : 'prev';
	return 'fade';
}

/* ------------------------------------------------------------------ swipe */

export interface SwipeOptions {
	/** Finger moved right-to-left. */
	left?: () => void;
	/** Finger moved left-to-right. */
	right?: () => void;
}

/**
 * Sideways swipes only, so it never fights with scrolling. Ignores touches that start in
 * inputs, open sheets, sideways-scrolling rows (`data-no-swipe`) or at the screen edges,
 * where phones use the gesture for "back".
 */
export function swipe(node: HTMLElement, options: SwipeOptions) {
	let opts = options;
	let x0 = 0;
	let y0 = 0;
	let t0 = 0;
	let tracking = false;

	const start = (e: TouchEvent) => {
		tracking = false;
		if (e.touches.length !== 1) return;
		const t = e.touches[0];
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [role="dialog"], [data-no-swipe]')) return;
		if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;
		x0 = t.clientX;
		y0 = t.clientY;
		t0 = Date.now();
		tracking = true;
	};
	const end = (e: TouchEvent) => {
		if (!tracking) return;
		tracking = false;
		const t = e.changedTouches[0];
		const dx = t.clientX - x0;
		const dy = t.clientY - y0;
		if (Date.now() - t0 > 650) return;
		if (Math.abs(dx) < 64 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
		if (dx < 0) opts.left?.();
		else opts.right?.();
	};

	node.addEventListener('touchstart', start, { passive: true });
	node.addEventListener('touchend', end, { passive: true });
	return {
		update(o: SwipeOptions) {
			opts = o;
		},
		destroy() {
			node.removeEventListener('touchstart', start);
			node.removeEventListener('touchend', end);
		}
	};
}
