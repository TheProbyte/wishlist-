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
	function touchstart(e: TouchEvent) {
		cancel();
		// The innermost element with a menu gets the hold.
		if (o.touch === false || e.touches.length !== 1 || (e as TouchEvent & { menuClaimed?: boolean }).menuClaimed) return;
		if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		(e as TouchEvent & { menuClaimed?: boolean }).menuClaimed = true;
		sx = e.touches[0].clientX;
		sy = e.touches[0].clientY;
		node.setAttribute('data-holding', '');
		timer = setTimeout(fire, HOLD);
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
		}
		cancel();
	}
	function cancel() {
		clearTimeout(timer);
		timer = undefined;
		node.removeAttribute('data-holding');
	}
	function fire() {
		timer = undefined;
		node.removeAttribute('data-holding');
		const spec = o.spec();
		if (!spec) return;
		held = true;
		navigator.vibrate?.(8);
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
