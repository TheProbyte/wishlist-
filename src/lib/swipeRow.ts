import type { Action } from 'svelte/action';

/**
 * Swipe a gift row sideways (phones, compact view): the row follows your finger and shows what
 * letting go will do underneath. Left far enough deletes it (with Undo), right far enough moves
 * it to the top. Not far enough and it springs back. Up and down still scroll as usual.
 *
 * The row element gets `touch-action: pan-y` while this is on, so the browser leaves sideways
 * moves on it to us (swiping between categories still works from the chips and the gaps).
 */
export interface SwipeRowOptions {
	enabled: boolean;
	onleft: () => void;
	onright?: () => void;
}

const ARM = 88; // px: past this, letting go does it
const EDGE = 28; // the left edge belongs to swipe-back

export const swipeRow: Action<HTMLElement, SwipeRowOptions> = (node, initial) => {
	let o = initial;
	let sx = 0;
	let sy = 0;
	let dx = 0;
	let mode: 'idle' | 'undecided' | 'swipe' | 'scroll' = 'idle';
	let armed: 'left' | 'right' | null = null;
	const card = () => node.querySelector<HTMLElement>('article');

	function apply() {
		node.style.touchAction = o.enabled ? 'pan-y' : '';
	}
	apply();

	function set(x: number, animate = false) {
		const c = card();
		if (!c) return;
		c.style.transition = animate ? 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none';
		c.style.transform = x ? `translateX(${x}px)` : '';
	}

	function start(e: TouchEvent) {
		if (!o.enabled || e.touches.length !== 1 || e.touches[0].clientX < EDGE) return;
		mode = 'undecided';
		sx = e.touches[0].clientX;
		sy = e.touches[0].clientY;
		dx = 0;
	}
	function move(e: TouchEvent) {
		if (mode === 'idle' || mode === 'scroll') return;
		// Held long enough to pick the gift up and drag it: that's dragging, not swiping.
		if (document.documentElement.dataset.lifted !== undefined && mode === 'undecided') return void (mode = 'scroll');
		const t = e.touches[0];
		const ddx = t.clientX - sx;
		const ddy = t.clientY - sy;
		if (mode === 'undecided') {
			if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
			mode = Math.abs(ddx) > Math.abs(ddy) * 1.2 ? 'swipe' : 'scroll';
			if (mode === 'scroll') return;
			node.dataset.swiping = '';
			sx = t.clientX; // follow from here, no jump
		}
		if (e.cancelable) e.preventDefault();
		let d = t.clientX - sx;
		// Right only means something if there's a "move to top"; past the mark it gets heavier.
		if (d > 0 && !o.onright) d /= 5;
		if (Math.abs(d) > ARM * 1.6) d = Math.sign(d) * (ARM * 1.6 + (Math.abs(d) - ARM * 1.6) / 4);
		dx = d;
		set(d);
		const now = d <= -ARM ? 'left' : d >= ARM && o.onright ? 'right' : null;
		if (now !== armed) {
			armed = now;
			if (now) {
				node.dataset.armed = now;
				navigator.vibrate?.(6);
			} else delete node.dataset.armed;
		}
	}
	function end() {
		if (mode !== 'swipe') {
			mode = 'idle';
			return;
		}
		mode = 'idle';
		const did = armed;
		armed = null;
		delete node.dataset.armed;
		if (did === 'left') {
			// Off it goes to the left, then it's deleted (the list closes the gap).
			const c = card();
			set(-(c?.offsetWidth ?? 400) - 40, true);
			setTimeout(() => {
				delete node.dataset.swiping;
				o.onleft();
			}, 200);
			return;
		}
		set(0, true);
		setTimeout(() => delete node.dataset.swiping, 260);
		if (did === 'right') o.onright?.();
	}

	node.addEventListener('touchstart', start, { passive: true });
	node.addEventListener('touchmove', move, { passive: false });
	node.addEventListener('touchend', end);
	node.addEventListener('touchcancel', end);
	return {
		update(next) {
			o = next;
			apply();
		},
		destroy() {
			node.removeEventListener('touchstart', start);
			node.removeEventListener('touchmove', move);
			node.removeEventListener('touchend', end);
			node.removeEventListener('touchcancel', end);
		}
	};
};
