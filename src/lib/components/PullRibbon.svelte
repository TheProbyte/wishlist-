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
		class="-mt-[18px] shrink-0 transition-transform duration-200 ease-[var(--ease-spring)] {refreshing ? 'bow-busy' : ''}"
		style="transform: scale({dist ? Math.min(1, 0.35 + (dist / READY) * 0.65) * (ready ? 1.12 : 1) : 0}) rotate({ready ? 0 : (1 - dist / READY) * -24}deg); opacity: {dist ? 1 : 0}"
		width="72"
		height="64"
		viewBox="0 0 72 64"
		aria-hidden="true"
	>
		<!-- A ribbon bow: two round, upright loops (with a hole through each), a knot as wide as the
		     ribbon, and two tails as wide as the ribbon with notched ends. -->
		<g stroke="#2B1D14" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
			<path d="M30 30 L17 59 L23 55.5 L27 61 L40 32 Z" fill="#d2602d" />
			<path d="M42 30 L55 59 L49 55.5 L45 61 L32 32 Z" fill="#d2602d" />
			<path d="M33 25 C29 13 21 3 12 5 C3 7 2 20 10 25.5 C16 29.5 26 29 33 28 Z" fill="#e8a83a" />
			<path d="M39 25 C43 13 51 3 60 5 C69 7 70 20 62 25.5 C56 29.5 46 29 39 28 Z" fill="#e8a83a" />
		</g>
		<path d="M28 23 C25 16 19 10.5 14.5 11.5 C10 12.5 10.5 19 15 22 C18.5 24.3 23 24.3 28 24 Z" fill="#2B1D14" opacity="0.5" />
		<path d="M44 23 C47 16 53 10.5 57.5 11.5 C62 12.5 61.5 19 57 22 C53.5 24.3 49 24.3 44 24 Z" fill="#2B1D14" opacity="0.5" />
		<path d="M6 13 C8 6.5 15 5 21 8" fill="none" stroke="#f3c56a" stroke-width="2" stroke-linecap="round" />
		<path d="M66 13 C64 6.5 57 5 51 8" fill="none" stroke="#f3c56a" stroke-width="2" stroke-linecap="round" />
		<rect x="27" y="17" width="18" height="16" rx="5" fill="#3e8e87" stroke="#2B1D14" stroke-width="2.4" />
		<path d="M31.5 21 v8 M40.5 21 v8" stroke="#2f6f69" stroke-width="2" stroke-linecap="round" />
	</svg>
</div>
