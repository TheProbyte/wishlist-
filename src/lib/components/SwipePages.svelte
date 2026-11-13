<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { dur } from '#lib/motion.ts';

	/**
	 * Pages side by side in a native scroll-snap strip: a swipe follows the finger exactly and
	 * settles with the phone's own momentum. `active` follows the swipe, and setting it (from a
	 * chip, say) scrolls there. The strip is as tall as the page you're on.
	 */
	let {
		pages,
		active = $bindable(),
		page,
		onchange
	}: { pages: string[]; active: string; page: Snippet<[string]>; onchange?: (id: string) => void } = $props();

	let strip = $state<HTMLDivElement>();
	let height = $state<number | null>(null);
	let settledOn: string | null = null; // the page the last scroll landed on, so we don't scroll back to it

	function onscroll() {
		if (!strip) return;
		const id = pages[Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth))];
		if (id && id !== active) {
			settledOn = id;
			active = id;
			onchange?.(id);
		}
	}

	// Scroll to the active page when it's changed from outside (a chip tap).
	$effect(() => {
		const i = pages.indexOf(active);
		if (!strip || i < 0 || active === settledOn) return;
		const left = i * strip.clientWidth;
		if (Math.abs(strip.scrollLeft - left) > 2) strip.scrollTo({ left, behavior: dur(1) ? 'smooth' : 'auto' });
		settledOn = active;
		onchange?.(active);
	});

	// Track the active page's height.
	$effect(() => {
		const panel = strip?.querySelector<HTMLElement>(`[data-page="${CSS.escape(active)}"]`);
		if (!panel) return;
		const ro = new ResizeObserver(() => (height = panel.offsetHeight));
		ro.observe(panel);
		return () => ro.disconnect();
	});

	// Only the page you're on is drawn straight away; its neighbours follow once the phone is idle,
	// so they're ready before a swipe reaches them. Pages further off wait until they're near.
	// svelte-ignore state_referenced_locally
	const drawn = new SvelteSet<string>([active]);
	$effect(() => {
		const i = pages.indexOf(active);
		if (i < 0) return;
		drawn.add(active);
		const near = [pages[i - 1], pages[i + 1]].filter((id): id is string => !!id && !drawn.has(id));
		if (!near.length) return;
		const add = () => near.forEach((id) => drawn.add(id));
		const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
		if (ric) {
			const h = ric(add, { timeout: 400 });
			return () => (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(h);
		}
		const t = setTimeout(add, 150);
		return () => clearTimeout(t);
	});

	// If the active page disappears, fall back to the first one.
	$effect(() => {
		if (pages.length && !pages.includes(active)) active = pages[0];
	});
</script>

<div
	bind:this={strip}
	{onscroll}
	class="-mx-4 flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden {height ? 'transition-[height] duration-300 ease-[var(--ease-out-soft)]' : ''}"
	style={height ? `height: ${height}px` : ''}
>
	{#each pages as id (id)}
		<div class="w-full shrink-0 snap-start snap-always px-4 pb-2 sm:px-0" data-page={id} inert={id !== active}>
			{#if drawn.has(id)}{@render page(id)}{/if}
		</div>
	{/each}
</div>
