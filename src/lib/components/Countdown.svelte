<script lang="ts">
	import CountUp from './CountUp.svelte';

	/**
	 * Days to go, as a tear-off calendar leaf: a rust binding with two rings, a cream page with
	 * the number, and a torn bottom edge. "Today" shows a little bow instead of a number.
	 */
	let { days, size = 'sm' }: { days: number; size?: 'sm' | 'lg' } = $props();
	const lg = $derived(size === 'lg');
</script>

<span
	class="relative inline-flex shrink-0 -rotate-3 flex-col overflow-hidden rounded-[8px] bg-cream text-center text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)] {lg ? 'w-20' : 'w-[52px]'}"
	style="clip-path: polygon(0 0, 100% 0, 100% calc(100% - 4px), 87.5% 100%, 75% calc(100% - 4px), 62.5% 100%, 50% calc(100% - 4px), 37.5% 100%, 25% calc(100% - 4px), 12.5% 100%, 0 calc(100% - 4px))"
	role="img"
	aria-label={days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'} to go`}
>
	<span class="relative block bg-rust-500 {lg ? 'h-4' : 'h-2.5'}" aria-hidden="true">
		<span class="absolute top-1/2 left-[28%] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cocoa-950/70"></span>
		<span class="absolute top-1/2 right-[28%] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cocoa-950/70"></span>
	</span>
	<span class="display block leading-none {lg ? 'pt-2 text-[34px]' : 'pt-1 text-[22px]'}" aria-hidden="true">
		{#if days === 0}★{:else}<CountUp value={days} />{/if}
	</span>
	<span class="block font-bold {lg ? 'pt-0.5 pb-2.5 text-xs' : 'pb-1.5 text-[10px]'}" aria-hidden="true">{days === 0 ? 'today' : days === 1 ? 'day' : 'days'}</span>
</span>
