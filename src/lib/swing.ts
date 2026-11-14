import type { Action } from 'svelte/action';
import { prefersReducedMotion } from './motion.ts';

/**
 * Gift tags on strings swing as you scroll past them: each scroll gives them a nudge (harder the
 * faster you go), and a spring brings them back, swaying to a stop. Sets `--swing` (degrees) on
 * the element; each tag turns by that times its own `--k`, so neighbours don't move in lockstep.
 * Runs only while something's moving.
 */
export const swingOnScroll: Action<HTMLElement> = (node) => {
	if (prefersReducedMotion()) return;
	const scroller: HTMLElement | Window = node.closest<HTMLElement>('[data-ptr]') ?? window;
	const pos = () => (scroller instanceof Window ? scrollY : scroller.scrollTop);
	let angle = 0;
	let speed = 0;
	let frame = 0;
	let lastY = pos();
	let lastT = performance.now();

	function step() {
		// A damped spring: pulled back to straight, losing a little each swing.
		speed += -0.045 * angle - 0.09 * speed;
		angle = Math.max(-8, Math.min(8, angle + speed));
		node.style.setProperty('--swing', angle.toFixed(2));
		if (Math.abs(angle) < 0.03 && Math.abs(speed) < 0.03) {
			angle = speed = 0;
			node.style.setProperty('--swing', '0');
			frame = 0;
			return;
		}
		frame = requestAnimationFrame(step);
	}
	function onScroll() {
		const y = pos();
		const t = performance.now();
		const v = (y - lastY) / Math.max(8, t - lastT); // px per ms
		lastY = y;
		lastT = t;
		speed = Math.max(-1.8, Math.min(1.8, speed + v * 0.6));
		if (!frame) frame = requestAnimationFrame(step);
	}
	scroller.addEventListener('scroll', onScroll, { passive: true });
	return {
		destroy() {
			scroller.removeEventListener('scroll', onScroll);
			cancelAnimationFrame(frame);
		}
	};
};
