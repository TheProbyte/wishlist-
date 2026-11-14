<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { prefersReducedMotion } from '#lib/motion.ts';

	/**
	 * Pull to refresh, as a ribbon: pull down at the top of a page and a three-stripe ribbon
	 * unrolls from the header with a bow on the end. Past the line the bow ties itself (a little
	 * pop); let go and the stripes run while the page refreshes, then the ribbon rolls back up.
	 * Lives inside the header. Scrolling areas that aren't the page mark themselves `data-ptr`.
	 */
	let { enabled = true }: { enabled?: boolean } = $props();

	const READY = 64;
	const MAX = 120;

	let dist = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);
	const ready = $derived(dist >= READY);

	onMount(() => {
		let x0 = 0;
		let y0 = 0;
		let axis: 'y' | 'none' | null = null;
		let scroller: Element | null = null;
		let tracking = false;

		const atTop = () => (scroller ? scroller.scrollTop <= 0 : true);

		const start = (e: TouchEvent) => {
			tracking = false;
			if (!enabled || refreshing || e.touches.length !== 1) return;
			const target = e.target as HTMLElement;
			if (target.closest('[role="dialog"], input, textarea, select') || document.documentElement.hasAttribute('data-lifted')) return;
			scroller = target.closest('[data-ptr]') ?? document.scrollingElement;
			if (!atTop()) return;
			x0 = e.touches[0].clientX;
			y0 = e.touches[0].clientY;
			axis = null;
			tracking = true;
		};
		const move = (e: TouchEvent) => {
			if (!tracking) return;
			const dx = e.touches[0].clientX - x0;
			const dy = e.touches[0].clientY - y0;
			if (!axis) {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				axis = dy > 0 && dy > Math.abs(dx) * 1.2 && atTop() ? 'y' : 'none';
				if (axis === 'none') return void (tracking = false);
				pulling = true;
			}
			if (e.cancelable) e.preventDefault();
			// Resists more the further it goes.
			dist = Math.min(MAX, Math.max(0, dy) * 0.5);
		};
		const end = async () => {
			if (!tracking) return;
			tracking = false;
			pulling = false;
			if (axis !== 'y') return;
			if (dist < READY) return void (dist = 0);
			refreshing = true;
			dist = 56;
			navigator.vibrate?.(8);
			await Promise.all([invalidateAll().catch(() => {}), new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : 700))]);
			refreshing = false;
			dist = 0;
		};

		addEventListener('touchstart', start, { passive: true });
		addEventListener('touchmove', move, { passive: false });
		addEventListener('touchend', end);
		addEventListener('touchcancel', end);
		return () => {
			removeEventListener('touchstart', start);
			removeEventListener('touchmove', move);
			removeEventListener('touchend', end);
			removeEventListener('touchcancel', end);
		};
	});
</script>

<div
	class="pointer-events-none absolute top-full left-1/2 z-10 flex -translate-x-1/2 flex-col items-center {pulling ? '' : 'transition-[height] duration-300 ease-[var(--ease-spring)]'}"
	style="height: {dist}px"
	role={refreshing ? 'progressbar' : undefined}
	aria-label={refreshing ? 'Refreshing' : undefined}
	aria-hidden={!refreshing}
>
	<!-- The ribbon: the header's three stripes, running downwards. -->
	<div class="ribbon-tail w-[18px] flex-1 {refreshing ? 'ribbon-run' : ''}"></div>
	<!-- The bow on the end: grows as you pull, ties itself at the line. -->
	<svg
		class="-mt-2 shrink-0 transition-transform duration-200 ease-[var(--ease-spring)] {refreshing ? 'bow-busy' : ''}"
		style="transform: scale({dist ? Math.min(1, 0.35 + (dist / READY) * 0.65) * (ready ? 1.12 : 1) : 0}) rotate({ready ? 0 : (1 - dist / READY) * -24}deg); opacity: {dist ? 1 : 0}"
		width="52"
		height="40"
		viewBox="0 0 68 52"
		aria-hidden="true"
	>
		<g stroke="#2B1D14" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
			<path d="M31 31l-11 18 7-1 3 5 6-18z" fill="#d2602d" />
			<path d="M37 31l11 18-7-1-3 5-6-18z" fill="#d2602d" />
			<path d="M34 30C26 12 6 5 5 18c-1 12 17 14 29 12z" fill="#e8a83a" />
			<path d="M34 30C42 12 62 5 63 18c1 12-17 14-29 12z" fill="#e8a83a" />
			<rect x="27" y="23" width="14" height="14" rx="5" fill="#3e8e87" />
		</g>
	</svg>
</div>
