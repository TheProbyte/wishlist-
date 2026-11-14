import { prefersReducedMotion, setNavDirection } from './motion.ts';

/**
 * Swipe back from the left edge, on any page that isn't a tab.
 *
 * The page peels away to the right with a torn paper edge, following the finger, and what
 * you're going back to shows underneath. Let go past about a third of the way (or flick) and
 * it carries on and goes back; otherwise it springs back.
 *
 * The page moves by its `left` offset, not a transform, so bars fixed inside it (toolbars,
 * select bars) aren't thrown off; those follow along through the `--peel` variable
 * (`.peel-follow`). Safari in the browser has its own edge swipe, so this stays out of its way;
 * the installed app gets this one.
 */
export interface EdgeBackOptions {
	/** Whether this page can be swiped back from (not on the tabs or a share link). */
	enabled: () => boolean;
	/** Go back. Resolves once the previous page is on screen. */
	back: () => Promise<unknown>;
	/** The underlay's label, e.g. "Lists". */
	label: () => string;
}

const EDGE = 26;

export function edgeBack(opts: EdgeBackOptions): () => void {
	const ua = navigator.userAgent;
	const iosBrowser =
		/iP(hone|ad|od)/.test(ua) &&
		!(navigator as Navigator & { standalone?: boolean }).standalone &&
		!matchMedia('(display-mode: standalone)').matches;
	if (iosBrowser) return () => {};

	const root = document.documentElement;
	const main = () => document.querySelector('main');
	let tracking = false;
	let axis: 'x' | 'y' | null = null;
	let x0 = 0;
	let y0 = 0;
	let dx = 0;
	let samples: { x: number; t: number }[] = [];
	let busy = false;
	let underlay: HTMLElement | null = null;
	let edge: HTMLElement | null = null;

	function setup() {
		root.dataset.peeling = '';
		underlay = document.createElement('div');
		underlay.className = 'peel-underlay';
		underlay.innerHTML = `<span class="peel-label"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>${escapeHtml(opts.label())}</span>`;
		document.body.appendChild(underlay);
		edge = document.createElement('div');
		edge.className = 'peel-edge';
		document.body.appendChild(edge);
	}

	function place(x: number, transition = '') {
		const m = main();
		if (!m) return;
		const w = innerWidth;
		m.style.transition = transition ? `left ${transition}` : 'none';
		m.style.left = `${x}px`;
		root.style.setProperty('--peel', `${x}px`);
		if (edge) {
			edge.style.transition = transition ? `transform ${transition}` : 'none';
			edge.style.transform = `translateX(${x}px)`;
		}
		if (underlay) {
			const p = Math.min(1, x / (w * 0.5));
			underlay.style.transition = transition ? `opacity ${transition}` : 'none';
			underlay.style.opacity = String(0.35 + p * 0.65);
			underlay.style.setProperty('--p', String(p));
		}
	}

	function teardown() {
		const m = main();
		if (m) {
			m.style.transition = '';
			m.style.left = '';
		}
		root.style.removeProperty('--peel');
		delete root.dataset.peeling;
		underlay?.remove();
		edge?.remove();
		underlay = edge = null;
	}

	const start = (e: TouchEvent) => {
		tracking = false;
		if (busy || e.touches.length !== 1 || !opts.enabled()) return;
		const t = e.touches[0];
		if (t.clientX > EDGE) return;
		if (document.querySelector('[role="dialog"]')) return;
		tracking = true;
		axis = null;
		x0 = t.clientX;
		y0 = t.clientY;
		dx = 0;
		samples = [{ x: t.clientX, t: performance.now() }];
	};

	const move = (e: TouchEvent) => {
		if (!tracking) return;
		const t = e.touches[0];
		const mx = t.clientX - x0;
		const my = t.clientY - y0;
		if (!axis) {
			if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
			axis = mx > 0 && mx > Math.abs(my) * 1.1 ? 'x' : 'y';
			if (axis === 'y') return void (tracking = false);
			setup();
		}
		if (e.cancelable) e.preventDefault();
		dx = Math.max(0, mx);
		samples.push({ x: t.clientX, t: performance.now() });
		if (samples.length > 6) samples.shift();
		place(dx);
	};

	const end = async () => {
		if (!tracking) return;
		tracking = false;
		if (axis !== 'x') return;
		const first = samples[0];
		const last = samples.at(-1)!;
		const v = (last.x - first.x) / Math.max(1, last.t - first.t);
		const go = dx > innerWidth * 0.33 || (v > 0.5 && dx > 40);
		if (!go) {
			place(0, '280ms var(--ease-spring)');
			setTimeout(teardown, 290);
			return;
		}
		busy = true;
		const fast = prefersReducedMotion() ? '0ms' : '170ms cubic-bezier(0.3, 0, 0.6, 1)';
		place(innerWidth + 30, fast);
		await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : 170));
		setNavDirection('none');
		try {
			await opts.back();
		} catch {
			/* stay put */
		}
		// The previous page is in place: bring it in with a short fade, then tidy up.
		const m = main();
		teardown();
		if (m && !prefersReducedMotion()) {
			m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
		}
		busy = false;
	};

	addEventListener('touchstart', start, { passive: true });
	addEventListener('touchmove', move, { passive: false });
	addEventListener('touchend', end);
	addEventListener('touchcancel', end);
	return () => {
		removeEventListener('touchstart', start);
		removeEventListener('touchmove', move);
		removeEventListener('touchend', end);
		removeEventListener('touchcancel', end);
		teardown();
	};
}

function escapeHtml(s: string) {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
