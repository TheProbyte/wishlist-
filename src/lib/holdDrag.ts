import type { Action } from 'svelte/action';
import { prefersReducedMotion } from './motion.ts';

/**
 * Press and hold a gift on a touch screen.
 *
 * - Hold still for a moment and the card lifts (a little buzz, if the phone can).
 * - Drag it while lifted to move it into a new place; `onover` fires as you pass other gifts,
 *   and `ondrop` when you let go. The page scrolls when you drag near the top or bottom.
 * - Let go without dragging and `onhold` fires instead (the page uses it to start selecting).
 *
 * Moving your finger before the card lifts is an ordinary scroll or swipe, untouched.
 * Each card needs `data-gift={id}` so the drag can tell what's under the finger.
 */
export type HoldDragOptions = {
	id: string;
	/** Whether holding does anything at all (off while selecting). */
	enabled: boolean;
	/** Whether a lifted card can be dragged to a new place (only when the order is showing). */
	draggable: boolean;
	onhold?: (id: string) => void;
	onover?: (dragId: string, overId: string) => void;
	ondrop?: (dragId: string) => void;
};

const HOLD_MS = 380;
const SLOP = 9;
const EDGE = 56;

export const holdDrag: Action<HTMLElement, HoldDragOptions> = (node, initial) => {
	let o = initial;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lifted = false;
	let moved = false;
	let startX = 0;
	let startY = 0;
	let x = 0;
	let y = 0;
	let ghost: HTMLElement | null = null;
	let origin = { left: 0, top: 0 };
	let scrollFrame = 0;
	let lastOver: string | undefined;

	function down(e: TouchEvent) {
		if (!o.enabled || e.touches.length !== 1) return cancel();
		startX = x = e.touches[0].clientX;
		startY = y = e.touches[0].clientY;
		timer = setTimeout(lift, HOLD_MS);
	}

	function lift() {
		timer = undefined;
		lifted = true;
		moved = false;
		lastOver = o.id;
		navigator.vibrate?.(8);
		const r = node.getBoundingClientRect();
		origin = { left: r.left, top: r.top };
		// A floating copy follows the finger; the card itself stays behind as the gap.
		ghost = node.cloneNode(true) as HTMLElement;
		ghost.removeAttribute('data-gift');
		ghost.removeAttribute('data-slot');
		ghost.setAttribute('aria-hidden', 'true');
		Object.assign(ghost.style, {
			position: 'fixed',
			left: `${r.left}px`,
			top: `${r.top}px`,
			width: `${r.width}px`,
			height: `${r.height}px`,
			margin: '0',
			zIndex: '60',
			pointerEvents: 'none',
			transition: prefersReducedMotion() ? 'none' : 'transform 140ms var(--ease-spring), box-shadow 140ms',
			transform: 'scale(1.04) rotate(-1deg)',
			boxShadow: '0 6px 0 0 var(--color-edge), 0 24px 48px -12px rgb(0 0 0 / 0.8)',
			borderRadius: 'var(--radius-card)',
			animation: 'none'
		});
		document.body.appendChild(ghost);
		// Where it'll land: an empty dashed space, not a second copy of the card.
		node.dataset.slot = '';
		document.documentElement.dataset.lifted = '';
		// After the lift, the copy tracks the finger without lag.
		requestAnimationFrame(() => ghost && (ghost.style.transition = 'box-shadow 140ms'));
	}

	function move(e: TouchEvent) {
		const t = e.touches[0];
		if (!t) return;
		if (timer) {
			// Moving before the hold completes means scrolling or swiping: let it be.
			if (Math.hypot(t.clientX - startX, t.clientY - startY) > SLOP) cancel();
			return;
		}
		if (!lifted) return;
		e.preventDefault();
		x = t.clientX;
		y = t.clientY;
		if (Math.hypot(x - startX, y - startY) > SLOP) moved = true;
		if (!o.draggable) return;
		place();
		hitTest();
		if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
	}

	function place() {
		if (ghost) ghost.style.transform = `translate(${x - startX}px, ${y - startY}px) scale(1.04) rotate(-1deg)`;
	}

	function hitTest() {
		// Look through anything floating on top (the paste bar, the tab bar) to the gifts below.
		const over = document
			.elementsFromPoint(x, y)
			.map((el) => el.closest<HTMLElement>('[data-gift]'))
			.find(Boolean);
		const overId = over?.dataset.gift;
		// Only when the finger reaches a new gift: the one just moved aside can slide back under
		// the finger, and swapping again would make them wobble.
		if (overId === lastOver) return;
		lastOver = overId;
		if (overId && overId !== o.id) o.onover?.(o.id, overId);
	}

	// Near the top or bottom of the screen, scroll so you can drag a gift a long way.
	function autoScroll() {
		scrollFrame = 0;
		if (!lifted) return;
		// The edges of what you can see: under the header, and above the tab bar.
		const top = 76 + EDGE;
		const bottom = innerHeight - 64 - EDGE;
		const speed = !moved ? 0 : y < top ? -Math.min(16, (top - y) / 4) : y > bottom ? Math.min(16, (y - bottom) / 4) : 0;
		if (speed) {
			scrollBy(0, speed);
			hitTest();
		}
		if (speed) scrollFrame = requestAnimationFrame(autoScroll);
	}

	function up() {
		if (timer) return cancel();
		if (!lifted) return;
		const wasMoved = moved && o.draggable;
		// A click follows letting go; it shouldn't also open the gift.
		const swallow = (e: Event) => {
			e.stopPropagation();
			e.preventDefault();
		};
		addEventListener('click', swallow, { capture: true, once: true });
		setTimeout(() => removeEventListener('click', swallow, { capture: true }), 450);
		settle();
		if (wasMoved) o.ondrop?.(o.id);
		else o.onhold?.(o.id);
	}

	// The copy glides into the gap the card left, then the card comes back.
	function settle() {
		lifted = false;
		delete document.documentElement.dataset.lifted;
		cancelAnimationFrame(scrollFrame);
		scrollFrame = 0;
		const g = ghost;
		ghost = null;
		if (!g) return void (delete node.dataset.slot);
		requestAnimationFrame(() => {
			const r = node.getBoundingClientRect();
			if (prefersReducedMotion()) {
				g.remove();
				delete node.dataset.slot;
				return;
			}
			g.style.transition = 'transform 180ms var(--ease-out-soft), box-shadow 180ms';
			g.style.transform = `translate(${r.left - origin.left}px, ${r.top - origin.top}px)`;
			g.style.boxShadow = '0 3px 0 0 var(--color-edge)';
			setTimeout(() => {
				g.remove();
				delete node.dataset.slot;
			}, 190);
		});
	}

	function cancel() {
		clearTimeout(timer);
		timer = undefined;
		if (lifted) settle();
	}

	// Long-pressing shouldn't open the browser's own menu for the photo.
	function contextmenu(e: Event) {
		if (timer || lifted) e.preventDefault();
	}

	node.addEventListener('touchstart', down, { passive: true });
	node.addEventListener('touchmove', move, { passive: false });
	node.addEventListener('touchend', up);
	node.addEventListener('touchcancel', cancel);
	node.addEventListener('contextmenu', contextmenu);

	return {
		update(next) {
			o = next;
		},
		destroy() {
			cancel();
			ghost?.remove();
			node.removeEventListener('touchstart', down);
			node.removeEventListener('touchmove', move);
			node.removeEventListener('touchend', up);
			node.removeEventListener('touchcancel', cancel);
			node.removeEventListener('contextmenu', contextmenu);
		}
	};
};
