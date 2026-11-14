import { goto, preloadData } from '$app/navigation';
import { tick } from 'svelte';
import { prefersReducedMotion, setNavDirection } from './motion.ts';

/**
 * Opening a list from the shelf, like opening a present:
 *
 * 1. The present lifts (a little wiggle) while the list's data loads in the background.
 * 2. It grows up to the top of the page, stretching to the width of the list's header strip (the
 *    paper's pattern doesn't stretch), and the shelf fades out behind it. Nothing of the list is
 *    drawn yet, so nothing pops in.
 * 3. Only then does the list page draw, hidden under the present, with its gifts held still.
 * 4. The seam tears (a small jolt), the bottom drops off the screen fast, and the gifts rise into
 *    place as they're revealed. The top piece is the list's header strip.
 *
 * The tab bar on phones stays where it is throughout; everything happens above it.
 */

/** The bottom of the site header (taller in the installed app, below the status bar). */
const headerBottom = () => document.querySelector('header')?.getBoundingClientRect().bottom ?? 76;
const BACKGROUND = 'var(--color-cocoa-950)';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/** Where the list page's paper strip will be (matches routes/lists/[id] and PaperStrip). */
function stripGuess() {
	const vw = innerWidth;
	const wide = vw >= 640;
	const pad = wide ? 24 : 16;
	const container = Math.min(vw, 1152);
	return { left: (vw - container) / 2 + pad, top: headerBottom() + (wide ? 40 : 28 - 12), width: container - pad * 2, height: wide ? 80 : 60 };
}

/** A torn edge across a box `w` wide at height `y`: teeth about every 16px, like PaperStrip's. */
function seam(w: number, y: number, depth = 7) {
	const teeth = Math.max(8, Math.round(w / 16));
	const pts: string[] = [];
	for (let i = 0; i <= teeth; i++) pts.push(`${((i / teeth) * 100).toFixed(2)}% ${i % 2 ? y - depth : y}px`);
	return pts;
}

function copy(present: HTMLElement) {
	const c = present.cloneNode(true) as HTMLElement;
	c.style.removeProperty('view-transition-name');
	c.style.removeProperty('view-transition-class');
	c.style.position = 'absolute';
	c.style.margin = '0';
	// The original is hidden while it opens; its copies must not inherit that.
	c.style.visibility = 'visible';
	return c;
}

export async function openPresent(present: HTMLElement, href: string, listId: string) {
	if (prefersReducedMotion()) return goto(href);
	const root = document.documentElement;
	const from = present.getBoundingClientRect();
	const strip = stripGuess();
	const grownH = strip.height + Math.min(300, Math.max(170, innerHeight * 0.36));
	const phone = innerWidth < 640;

	// Everything happens in one layer above the page (and above the tab bar's top edge, never on it).
	const layer = document.createElement('div');
	Object.assign(layer.style, { position: 'fixed', left: '0', right: '0', top: '0', bottom: phone ? 'calc(4rem + env(safe-area-inset-bottom))' : '0', zIndex: '70', overflow: 'hidden', pointerEvents: 'auto' });
	const cover = document.createElement('div');
	Object.assign(cover.style, { position: 'absolute', left: '0', right: '0', top: `${headerBottom()}px`, bottom: '0', background: BACKGROUND, opacity: '0' });
	layer.appendChild(cover);
	const box = copy(present);
	Object.assign(box.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
	layer.appendChild(box);
	document.body.appendChild(layer);
	present.style.visibility = 'hidden';

	// Load the list's data now; draw it later.
	const data = preloadData(href).catch(() => {});

	// 1. Lift.
	await box.animate(
		[
			{ transform: 'none' },
			{ transform: 'translateY(-8px) scale(1.06) rotate(-2deg)', offset: 0.6 },
			{ transform: 'translateY(-6px) scale(1.05) rotate(1deg)' }
		],
		{ duration: 170, easing: 'ease-out', fill: 'forwards' }
	).finished.catch(() => {});

	// 2. Grow to the top; the shelf goes behind a cover that's fully opaque before the grow ends.
	cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
	box.getAnimations().forEach((a) => a.cancel());
	await box.animate(
		[
			{ left: `${from.left}px`, top: `${from.top - 6}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '12px', transform: 'scale(1.05) rotate(1deg)' },
			{ left: `${strip.left}px`, top: `${strip.top}px`, width: `${strip.width}px`, height: `${grownH}px`, borderRadius: '24px 24px 14px 14px', transform: 'none' }
		],
		{ duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
	).finished.catch(() => {});

	// 3. Draw the list underneath, its gifts held still until they're revealed.
	root.dataset.opening = '';
	setNavDirection('none');
	await Promise.race([data, wait(2500)]);
	const arrived = goto(href).catch(() => {});
	// The bow fidgets if the list is slow to arrive.
	const fidget = setTimeout(() => box.querySelector('.bow')?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }], { duration: 500, iterations: Infinity }), 250);
	await Promise.race([arrived, wait(4000)]);
	clearTimeout(fidget);
	await tick();
	await frame();
	await frame();

	// Line the seam up with the real strip, now that it's on the page.
	const real = document.querySelector<HTMLElement>(`main [style*="view-transition-name: paper-${CSS.escape(listId)}"]`)?.getBoundingClientRect();
	const target = real && real.width > 0 ? { left: real.left, top: real.top, width: real.width, height: real.height } : strip;
	box.getAnimations().forEach((a) => a.cancel());
	Object.assign(box.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${grownH}px`, borderRadius: '24px 24px 14px 14px' });

	// 4. Tear along the seam: the top piece is the header strip; the bottom rides on a curtain
	// that hides the list until it falls.
	const line = seam(target.width, target.height);
	const top = box;
	top.style.clipPath = `polygon(0 0, 100% 0, ${[...line].reverse().join(', ')})`;
	const fallTop = target.top + target.height - 7;
	const faller = document.createElement('div');
	Object.assign(faller.style, { position: 'absolute', left: '0', right: '0', top: `${fallTop}px`, height: `${innerHeight * 2}px` });
	const curtain = document.createElement('div');
	Object.assign(curtain.style, { position: 'absolute', left: '0', right: '0', top: '7px', bottom: '0', background: BACKGROUND });
	faller.appendChild(curtain);
	const bottom = copy(present);
	Object.assign(bottom.style, {
		left: `${target.left}px`,
		top: `${-(target.height - 7)}px`,
		width: `${target.width}px`,
		height: `${grownH}px`,
		borderRadius: '24px 24px 14px 14px',
		clipPath: `polygon(${line.join(', ')}, 100% 100%, 0 100%)`,
		transformOrigin: '25% 0'
	});
	faller.appendChild(bottom);
	layer.appendChild(faller);
	cover.remove();

	// The rip: a small jolt apart.
	top.animate([{ transform: 'none' }, { transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
	await faller.animate([{ transform: 'none' }, { transform: 'translateY(9px)' }], { duration: 110, easing: 'cubic-bezier(0.3, 1.5, 0.6, 1)', fill: 'forwards' }).finished.catch(() => {});

	// The drop: fast, like it's heavy. The gifts rise into place as they're uncovered.
	delete root.dataset.opening;
	const drop = innerHeight - fallTop + 60;
	const fall = faller.animate([{ transform: 'translateY(9px)' }, { transform: `translateY(${drop}px)` }], {
		duration: 380,
		easing: 'cubic-bezier(0.55, 0, 0.85, 0.3)',
		fill: 'forwards'
	});
	bottom.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(5deg) translateX(14px)' }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
	top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 180, easing: 'ease-out', fill: 'forwards' });
	await fall.finished.catch(() => {});
	layer.remove();
}
