import type { Action } from 'svelte/action';
import { prefersReducedMotion } from './motion.ts';

/**
 * A gift tag on a string swings a little as it comes into view, settling back to still, like
 * it was just hung up. (Each time it scrolls back into view, not over and over while seen.)
 */
export const sway: Action<HTMLElement> = (node) => {
	if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
	const io = new IntersectionObserver(
		([e]) => {
			if (!e.isIntersecting) return;
			node.classList.remove('tag-sway');
			void node.offsetWidth;
			node.classList.add('tag-sway');
		},
		{ threshold: 0.35 }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
};
