import { goto } from '$app/navigation';
import { prefersReducedMotion, setNavDirection } from './motion.ts';

/**
 * Opening a list from the shelf: the present gives a little lift, then splits across the
 * middle along a torn zig-zag. The top half pops up and away; the bottom half drops off the
 * bottom of the screen, and the list's wishes are there underneath.
 *
 * The halves are copies of the present laid over the page, so the list can load and appear
 * beneath them while they fly.
 */
const SPLIT = 50;
const TEETH = 10;

function seam() {
	const pts: string[] = [];
	for (let i = 0; i <= TEETH; i++) pts.push(`${((i / TEETH) * 100).toFixed(2)}% ${i % 2 ? SPLIT + 5 : SPLIT - 3}%`);
	return pts;
}

export async function openPresent(present: HTMLElement, href: string) {
	if (prefersReducedMotion()) return goto(href);
	const r = present.getBoundingClientRect();
	const line = seam();
	const top = `polygon(0 0, 100% 0, ${[...line].reverse().join(', ')})`;
	const bottom = `polygon(${line.join(', ')}, 100% 100%, 0 100%)`;

	const half = (clip: string) => {
		const c = present.cloneNode(true) as HTMLElement;
		c.style.removeProperty('view-transition-name');
		c.style.removeProperty('view-transition-class');
		Object.assign(c.style, {
			position: 'fixed',
			left: `${r.left}px`,
			top: `${r.top}px`,
			width: `${r.width}px`,
			height: `${r.height}px`,
			margin: '0',
			zIndex: '70',
			pointerEvents: 'none',
			clipPath: clip,
			transformOrigin: '50% 50%'
		});
		document.body.appendChild(c);
		return c;
	};
	const upper = half(top);
	const lower = half(bottom);
	present.style.visibility = 'hidden';

	// A little lift while the list loads behind it.
	const lift = [{ transform: 'none' }, { transform: 'translateY(-6px) scale(1.04)' }];
	const timing = { duration: 140, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'forwards' as const };
	upper.animate(lift, timing);
	lower.animate(lift, timing);

	setNavDirection('none');
	const arrived = goto(href).catch(() => {});
	await Promise.all([arrived, new Promise((res) => setTimeout(res, 150))]);

	// Split: the top flies up and fades; the bottom falls off the screen.
	const fall = innerHeight - r.top + 40;
	const up = upper.animate(
		[
			{ transform: 'translateY(-6px) scale(1.04)', opacity: 1 },
			{ transform: `translate(-6px, -${Math.min(r.top + r.height, 220)}px) rotate(-7deg) scale(1.04)`, opacity: 0 }
		],
		{ duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' }
	);
	const down = lower.animate(
		[
			{ transform: 'translateY(-6px) scale(1.04)' },
			{ transform: 'translate(4px, 10px) rotate(2deg) scale(1.04)', offset: 0.18 },
			{ transform: `translate(18px, ${fall}px) rotate(9deg) scale(1.04)` }
		],
		{ duration: 560, easing: 'cubic-bezier(0.45, 0, 0.85, 0.35)', fill: 'forwards' }
	);
	await Promise.all([up.finished, down.finished]).catch(() => {});
	upper.remove();
	lower.remove();
}
