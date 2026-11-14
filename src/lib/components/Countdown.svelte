<script lang="ts">
	import { onMount } from 'svelte';
	import CountUp from './CountUp.svelte';
	import { getPref, setPref } from '#lib/prefs.ts';
	import { prefersReducedMotion } from '#lib/motion.ts';

	/**
	 * Days to go, as a tear-off calendar leaf: a rust binding with two rings, a cream page with
	 * the number, and a torn bottom edge. "Today" shows a little star instead of a number.
	 *
	 * With an `id`, it remembers the number it last showed on this device: when that's gone down
	 * since (a new day), the old page tears off and falls away to show today's.
	 */
	let { days, size = 'sm', id = null }: { days: number; size?: 'sm' | 'lg'; id?: string | null } = $props();
	const lg = $derived(size === 'lg');
	const CLIP = 'polygon(0 0, 100% 0, 100% calc(100% - 4px), 87.5% 100%, 75% calc(100% - 4px), 62.5% 100%, 50% calc(100% - 4px), 37.5% 100%, 25% calc(100% - 4px), 12.5% 100%, 0 calc(100% - 4px))';

	let torn = $state<number | null>(null);
	onMount(() => {
		if (!id) return;
		const key = `leaf:${id}`;
		const before = Number(getPref(key));
		setPref(key, String(days));
		if (!before || before <= days || before - days > 60 || prefersReducedMotion()) return;
		torn = before;
		const t = setTimeout(() => (torn = null), 1700);
		return () => clearTimeout(t);
	});
</script>

{#snippet leaf(n: number, count: boolean)}
	<span class="relative block bg-rust-500 {lg ? 'h-4' : 'h-2.5'}" aria-hidden="true">
		<span class="absolute top-1/2 left-[28%] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cocoa-950/70"></span>
		<span class="absolute top-1/2 right-[28%] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cocoa-950/70"></span>
	</span>
	<span class="display block leading-none {lg ? 'pt-2 text-[34px]' : 'pt-1 text-[22px]'}" aria-hidden="true">
		{#if n === 0}★{:else if count}<CountUp value={n} />{:else}{n}{/if}
	</span>
	<span class="block font-bold {lg ? 'pt-0.5 pb-2.5 text-xs' : 'pb-1.5 text-[10px]'}" aria-hidden="true">{n === 0 ? 'today' : n === 1 ? 'day' : 'days'}</span>
{/snippet}

<span class="relative inline-flex shrink-0 -rotate-3">
	<span
		class="relative inline-flex flex-col overflow-hidden rounded-[8px] bg-cream text-center text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)] {lg ? 'w-20' : 'w-[52px]'}"
		style="clip-path: {CLIP}"
		role="img"
		aria-label={days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'} to go`}
	>
		{@render leaf(days, torn == null)}
	</span>
	{#if torn != null}
		<!-- Yesterday's page, torn off: it hangs a moment, then rips away and falls. -->
		<span class="leaf-tear pointer-events-none absolute inset-0 z-10 flex flex-col overflow-hidden rounded-[8px] bg-cream text-center text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)]" style="clip-path: {CLIP}" aria-hidden="true">
			{@render leaf(torn, false)}
		</span>
	{/if}
</span>
