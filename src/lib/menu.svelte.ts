import type { Action } from 'svelte/action';

/**
 * The app's own menu, in place of the browser's: right-click with a mouse, or press and hold
 * with a finger, on anything that has one (lists on the shelf, people, circles, the tab bar,
 * gifts). Everywhere else the browser's menu and the phone's link preview are simply off.
 *
 * `use:contextMenu={{ spec: () => ({ title, items }) }}` on an element gives it a menu; the one
 * menu on screen is drawn by ContextMenu.svelte in the layout.
 */

export type MenuAction = {
	label: string;
	icon?: string;
	/** Small, faint text on the right (a shortcut, a count). */
	hint?: string;
	/** Go somewhere: inside the app, or (external) a shop in a new tab. */
	href?: string;
	external?: boolean;
	run?: () => unknown;
	danger?: boolean;
	/** Needs a second tap: the button turns into this, and only the second tap does it. */
	confirm?: string;
};
/** A row of wrapping-paper swatches. */
export type MenuPapers = {
	papers: { id: string; name: string; background: string }[];
	current: string | null;
	pick: (id: string) => unknown;
};
export type MenuItem = MenuAction | MenuPapers | 'divider';

export interface MenuSpec {
	title?: string;
	sub?: string;
	items: MenuItem[];
}

export const menu = $state<{ spec: MenuSpec | null; x: number; y: number; touch: boolean; owner: HTMLElement | null }>({
	spec: null,
	x: 0,
	y: 0,
	touch: false,
	owner: null
});
let openedAt = 0;

export function openMenu(spec: MenuSpec, x: number, y: number, touch: boolean, owner: HTMLElement | null = null) {
	closeMenu();
	menu.spec = spec;
	menu.x = x;
	menu.y = y;
	menu.touch = touch;
	menu.owner = owner;
	owner?.setAttribute('data-menu-open', '');
	openedAt = performance.now();
}

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A light tap you can feel as the menu opens. Android: vibrate. iPhone (iOS 18+) has no way in
 *  but one: switching a switch control gives the system's own tick. */
let haptic: HTMLLabelElement | null = null;
function buzz() {
	if (navigator.vibrate) {
		navigator.vibrate(8);
		return;
	}
	if (!haptic) {
		haptic = document.createElement('label');
		haptic.setAttribute('aria-hidden', 'true');
		haptic.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.setAttribute('switch', '');
		input.tabIndex = -1;
		haptic.appendChild(input);
		document.body.appendChild(haptic);
	}
	haptic.click();
	haptic.querySelector('input')?.blur();
}

export function closeMenu() {
	menu.owner?.removeAttribute('data-menu-open');
	menu.owner = null;
	menu.spec = null;
}

/** How long a press counts as a hold. */
const HOLD = 450;

export interface ContextMenuOptions {
	/** The menu to show, worked out when it opens (null: no menu here, just nothing). */
	spec: () => MenuSpec | null;
	/** Also open on press-and-hold (default). Off where holding already means something, like dragging gifts. */
	touch?: boolean;
}

// After a hold opens a menu, the tap that ends it mustn't also follow the link underneath.
let swallowUntil = 0;
let installed = false;
function install() {
	if (installed) return;
	installed = true;
	addEventListener(
		'click',
		(e) => {
			if (performance.now() < swallowUntil) {
				e.preventDefault();
				e.stopPropagation();
				swallowUntil = 0;
			}
		},
		true
	);
}

export const contextMenu: Action<HTMLElement, ContextMenuOptions> = (node, initial) => {
	let o = initial;
	install();

	function oncontextmenu(e: MouseEvent) {
		const spec = o.spec();
		if (!spec) return;
		e.preventDefault();
		e.stopPropagation();
		// Android also sends this at the end of a hold, after we've already opened the menu.
		if (menu.spec && performance.now() - openedAt < 1000) return;
		openMenu(spec, e.clientX, e.clientY, false, node);
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	let held = false;
	let sx = 0;
	let sy = 0;

	/* How a hold feels: one continuous motion. The thing you're pressing sinks steadily for the
	   whole hold (a quick tap barely moves it), and at the moment the menu grows out from under
	   your finger it eases back up, both in the same frame. Only the marked part moves
	   ([data-lift], e.g. the present, not its shelf and name). */
	let anim: Animation | undefined;
	const target = () => node.querySelector<HTMLElement>('[data-lift]') ?? node;
	const STILL = 90; // nothing moves for the first moment, so taps stay still
	function sink() {
		if (prefersReduced()) return;
		anim?.cancel();
		anim = target().animate([{ scale: '1' }, { scale: '0.95' }], { duration: HOLD - STILL, delay: STILL, easing: 'cubic-bezier(0.3, 0, 0.6, 1)', fill: 'forwards' });
	}
	function rise(ms: number) {
		const el = target();
		const now = getComputedStyle(el).scale;
		anim?.cancel();
		anim = undefined;
		if (prefersReduced() || now === 'none' || Math.abs(parseFloat(now) - 1) < 0.002) return;
		anim = el.animate([{ scale: now }, { scale: '1' }], { duration: ms, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' });
	}

	function touchstart(e: TouchEvent) {
		cancel();
		// The innermost element with a menu gets the hold.
		if (o.touch === false || e.touches.length !== 1 || (e as TouchEvent & { menuClaimed?: boolean }).menuClaimed) return;
		if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		(e as TouchEvent & { menuClaimed?: boolean }).menuClaimed = true;
		sx = e.touches[0].clientX;
		sy = e.touches[0].clientY;
		timer = setTimeout(fire, HOLD);
		sink();
	}
	function touchmove(e: TouchEvent) {
		if (!timer) return;
		const t = e.touches[0];
		if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) cancel();
	}
	function touchend(e: TouchEvent) {
		if (held) {
			held = false;
			if (e.cancelable) e.preventDefault();
			swallowUntil = performance.now() + 300;
			return;
		}
		cancel();
	}
	function cancel() {
		if (timer) rise(160);
		clearTimeout(timer);
		timer = undefined;
	}
	function fire() {
		timer = undefined;
		const spec = o.spec();
		if (!spec) return rise(160);
		held = true;
		buzz();
		rise(240);
		openMenu(spec, sx, sy, true, node);
	}

	node.addEventListener('contextmenu', oncontextmenu);
	node.addEventListener('touchstart', touchstart, { passive: true });
	node.addEventListener('touchmove', touchmove, { passive: true });
	node.addEventListener('touchend', touchend, { passive: false });
	node.addEventListener('touchcancel', cancel);
	return {
		update(next) {
			o = next;
		},
		destroy() {
			cancel();
			if (menu.owner === node) closeMenu();
			node.removeEventListener('contextmenu', oncontextmenu);
			node.removeEventListener('touchstart', touchstart);
			node.removeEventListener('touchmove', touchmove);
			node.removeEventListener('touchend', touchend);
			node.removeEventListener('touchcancel', cancel);
		}
	};
};
