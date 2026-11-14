import { goto } from '$app/navigation';
import { prefersReducedMotion, setNavDirection } from './motion.ts';

/**
 * Opening a list from the shelf, like opening a present:
 *
 * 1. The present grows up to the top of the page, stretching to the width of the list's header
 *    strip (a square box stretches; the paper's pattern doesn't). The shelf fades away behind it.
 * 2. It splits along a torn seam where the header strip ends. The top piece settles exactly onto
 *    the list's own strip.
 * 3. The bottom piece drops off the screen, fast, and the list's gifts are revealed above it as
 *    it falls.
 *
 * The pieces are copies of the present laid over the page, so the list loads underneath while
 * the present grows.
 */

const HEADER = 76;
const BACKGROUND = 'var(--color-cocoa-950)';

/** Where the list page's paper strip will be (matches routes/lists/[id] and PaperStrip). */
function stripGuess() {
	const vw = innerWidth;
	const wide = vw >= 640;
	const pad = wide ? 24 : 16;
	const container = Math.min(vw, 1152);
	return {
		left: (vw - container) / 2 + pad,
		top: HEADER + (wide ? 40 : 28 - 12),
		width: container - pad * 2,
		height: wide ? 80 : 60
	};
}

/** A torn edge across a box `w` wide at height `y`: teeth about every 16px. */
function seam(w: number, y: number, depth = 7) {
	const teeth = Math.max(8, Math.round(w / 16));
	const pts: string[] = [];
	for (let i = 0; i <= teeth; i++) pts.push(`${((i / teeth) * 100).toFixed(2)}% ${i % 2 ? y - depth : y}px`);
	return pts;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openPresent(present: HTMLElement, href: string, listId: string) {
	if (prefersReducedMotion()) return goto(href);
	const from = present.getBoundingClientRect();
	const strip = stripGuess();
	// The grown present: as wide as the strip, tall enough that there's plenty to drop away.
	const grownH = strip.height + Math.min(300, Math.max(160, innerHeight * 0.36));

	const layer = document.createElement('div');
	Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '70', pointerEvents: 'none' });
	// Hides the shelf (below the app header) while the present grows.
	const cover = document.createElement('div');
	Object.assign(cover.style, { position: 'absolute', left: '0', right: '0', top: `${HEADER}px`, bottom: '0', background: BACKGROUND, opacity: '0' });
	layer.appendChild(cover);

	const box = present.cloneNode(true) as HTMLElement;
	box.style.removeProperty('view-transition-name');
	box.style.removeProperty('view-transition-class');
	Object.assign(box.style, { position: 'absolute', margin: '0', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
	layer.appendChild(box);
	document.body.appendChild(layer);
	present.style.visibility = 'hidden';

	setNavDirection('none');
	const arrived = goto(href).catch(() => {});

	// 1. Grow up to the top.
	const grow = { duration: 380, easing: 'cubic-bezier(0.3, 1.25, 0.45, 1)', fill: 'forwards' as const };
	cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out', fill: 'forwards' });
	await box.animate(
		[
			{ left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '12px' },
			{ left: `${strip.left}px`, top: `${strip.top}px`, width: `${strip.width}px`, height: `${grownH}px`, borderRadius: '24px 24px 14px 14px' }
		],
		grow
	).finished.catch(() => {});

	// Wait for the list (it's usually here already), but never hang on a slow connection.
	await Promise.race([arrived, wait(2500)]);

	// Line the seam up with the real strip, now that it's on the page.
	const real = document.querySelector<HTMLElement>(`main [style*="view-transition-name: paper-${CSS.escape(listId)}"]`)?.getBoundingClientRect();
	const target = real && real.width > 0 ? { left: real.left, top: real.top, width: real.width, height: real.height } : strip;

	// 2. Split: the top piece is the strip; the bottom piece rides on a cover that hides the
	// list until it falls.
	const seamLine = seam(target.width, target.height);
	const top = box;
	Object.assign(top.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${grownH}px` });
	top.getAnimations().forEach((a) => a.cancel());
	top.style.borderRadius = '24px 24px 14px 14px';
	top.style.clipPath = `polygon(0 0, 100% 0, ${[...seamLine].reverse().join(', ')})`;

	const faller = document.createElement('div');
	const fallTop = target.top + target.height - 7;
	Object.assign(faller.style, { position: 'absolute', left: '0', right: '0', top: `${fallTop}px`, height: `${innerHeight * 2}px` });
	// The curtain hiding the list starts just under the seam; the paper's torn edge rides on top.
	const curtain = document.createElement('div');
	Object.assign(curtain.style, { position: 'absolute', left: '0', right: '0', top: '7px', bottom: '0', background: BACKGROUND });
	faller.appendChild(curtain);
	const bottom = present.cloneNode(true) as HTMLElement;
	bottom.style.removeProperty('view-transition-name');
	bottom.style.removeProperty('view-transition-class');
	Object.assign(bottom.style, {
		position: 'absolute',
		margin: '0',
		left: `${target.left}px`,
		top: `${-(target.height - 7)}px`,
		width: `${target.width}px`,
		height: `${grownH}px`,
		borderRadius: '24px 24px 14px 14px',
		clipPath: `polygon(${seamLine.join(', ')}, 100% 100%, 0 100%)`,
		transformOrigin: '30% 0'
	});
	faller.appendChild(bottom);
	layer.appendChild(faller);
	cover.remove();

	// 3. The bottom drops away fast, revealing the list; the top piece hands over to the real strip.
	const drop = innerHeight - fallTop + 40;
	const fall = faller.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${drop}px)` }], {
		duration: 430,
		easing: 'cubic-bezier(0.55, 0, 0.9, 0.45)',
		fill: 'forwards'
	});
	bottom.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(4deg) translateX(10px)' }], { duration: 430, easing: 'ease-in', fill: 'forwards' });
	top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: 160, easing: 'ease-out', fill: 'forwards' });
	await fall.finished.catch(() => {});
	await wait(60);
	layer.remove();
}
