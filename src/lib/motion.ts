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

/** 'none': the page already animated itself (a live swipe), so skip the view transition. */
export type NavDirection = 'next' | 'prev' | 'open' | 'close' | 'fade' | 'none';

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

/* ------------------------------------------------------------- live page swipe */

export interface PageSwipeOptions {
	enabled?: boolean;
	/** Whether there is a page in that direction. If not, the page rubber-bands. */
	canLeft?: boolean;
	canRight?: boolean;
	/** Navigate. Called once the page has slid out; may return a promise that resolves on arrival. */
	left?: () => unknown;
	right?: () => unknown;
	/** Called as soon as a sideways drag starts, so the next page can load while the finger moves. */
	preload?: (direction: 'left' | 'right') => void;
	/** The element that moves. Defaults to the node itself. */
	target?: () => HTMLElement | null;
}

/**
 * A swipe that follows the finger: the page moves with it, and on release either carries on
 * out (and the next page slides in from the other side) or springs back.
 * Vertical scrolling is left to the browser (`touch-action: pan-y`).
 */
export function pageSwipe(node: HTMLElement, options: PageSwipeOptions) {
	let opts = options;
	let x0 = 0;
	let y0 = 0;
	let axis: 'x' | 'y' | null = null;
	let active = false;
	let busy = false;
	let dx = 0;
	let samples: { x: number; t: number }[] = [];

	const el = () => opts.target?.() ?? node;
	const width = () => el().getBoundingClientRect().width || window.innerWidth;
	const setTouchAction = () => (node.style.touchAction = opts.enabled === false ? '' : 'pan-y');
	setTouchAction();

	function place(x: number, animate: string | null) {
		const t = el();
		t.style.transition = animate ?? 'none';
		t.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
		t.style.opacity = x ? String(Math.max(0.35, 1 - Math.abs(x) / (width() * 1.6))) : '';
	}

	const start = (e: TouchEvent) => {
		active = false;
		if (busy || opts.enabled === false || e.touches.length !== 1) return;
		const t = e.touches[0];
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [role="dialog"], [data-no-swipe]')) return;
		if (t.clientX < 20 || t.clientX > window.innerWidth - 20) return;
		x0 = t.clientX;
		y0 = t.clientY;
		dx = 0;
		axis = null;
		samples = [{ x: t.clientX, t: performance.now() }];
		active = true;
	};

	const move = (e: TouchEvent) => {
		if (!active) return;
		const t = e.touches[0];
		const mx = t.clientX - x0;
		const my = t.clientY - y0;
		if (!axis) {
			if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
			axis = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
			if (axis === 'y') {
				active = false;
				return;
			}
			opts.preload?.(mx < 0 ? 'left' : 'right');
		}
		const allowed = mx < 0 ? opts.canLeft !== false && !!opts.left : opts.canRight !== false && !!opts.right;
		dx = allowed ? mx : mx * 0.22; // rubber band where there's nowhere to go
		samples.push({ x: t.clientX, t: performance.now() });
		if (samples.length > 6) samples.shift();
		place(dx, null);
	};

	const end = async () => {
		if (!active) return;
		active = false;
		if (axis !== 'x') return;
		const first = samples[0];
		const last = samples.at(-1)!;
		const velocity = (last.x - first.x) / Math.max(1, last.t - first.t); // px per ms
		const dir = dx < 0 ? 'left' : 'right';
		const go = dir === 'left' ? opts.left : opts.right;
		const allowed = dir === 'left' ? opts.canLeft !== false : opts.canRight !== false;
		const far = Math.abs(dx) > width() * 0.28;
		const flick = Math.abs(velocity) > 0.45 && Math.abs(dx) > 30 && Math.sign(velocity) === Math.sign(dx);

		if (!go || !allowed || !(far || flick) || prefersReducedMotion()) {
			if (go && allowed && (far || flick)) {
				place(0, null);
				await go();
				return;
			}
			place(0, 'transform 380ms var(--ease-spring), opacity 380ms ease');
			return;
		}

		busy = true;
		const w = width();
		const out = dir === 'left' ? -w : w;
		place(out, 'transform 190ms cubic-bezier(0.3, 0, 0.8, 0.4), opacity 190ms ease-in');
		await new Promise((r) => setTimeout(r, 190));
		setNavDirection('none');
		try {
			await go();
		} finally {
			// Bring the new page in from the other side.
			const t = el();
			place(-out * 0.35, null);
			t.style.opacity = '0';
			void t.offsetWidth;
			place(0, 'transform 320ms var(--ease-out-soft), opacity 240ms ease-out');
			setTimeout(() => {
				t.style.transition = '';
				busy = false;
			}, 330);
		}
	};

	node.addEventListener('touchstart', start, { passive: true });
	node.addEventListener('touchmove', move, { passive: true });
	node.addEventListener('touchend', end);
	node.addEventListener('touchcancel', end);
	return {
		update(o: PageSwipeOptions) {
			opts = o;
			setTouchAction();
		},
		destroy() {
			node.removeEventListener('touchstart', start);
			node.removeEventListener('touchmove', move);
			node.removeEventListener('touchend', end);
			node.removeEventListener('touchcancel', end);
			node.style.touchAction = '';
		}
	};
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
