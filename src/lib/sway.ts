import { prefersReducedMotion } from './motion.ts';

/**
 * Gift tags on strings swing a little and settle, like they were just hung up: on arriving at a
 * page and on leaving it (each tag a beat after the one before, via its --sway-delay).
 */
export function swayAll(container: HTMLElement) {
	if (prefersReducedMotion()) return;
	for (const tag of container.querySelectorAll<HTMLElement>('[data-lift]')) {
		tag.classList.remove('tag-sway');
		void tag.offsetWidth;
		tag.classList.add('tag-sway');
	}
}
