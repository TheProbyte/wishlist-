<script lang="ts">
	import Icon from './Icon.svelte';
	import { SIZE_FIELDS } from '#lib/sizes.ts';
	import type { Sizes } from '#lib/types.ts';

	/**
	 * Someone's sizes, as the little woven labels sewn into clothes: a picture of the thing, what
	 * it is, and the size. The same card is shown to givers. `row` keeps it to one sideways line.
	 */
	let { sizes, row = false, class: cls = '' }: { sizes: Sizes; row?: boolean; class?: string } = $props();
	const saved = $derived(SIZE_FIELDS.filter((f) => sizes[f.key]?.trim()));
</script>

{#snippet glyph(key: string)}
	{#if key === 'top'}<Icon name="shirt" size={20} />
	{:else if key === 'shoe'}<Icon name="shoe" size={20} />
	{:else if key === 'ring'}<Icon name="ring" size={20} />
	{:else}
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			{#if key === 'bottom'}<path d="M6 3h12l1 18h-5l-2-11-2 11H5z" /><path d="M6 6h12" />
			{:else if key === 'dress'}<path d="M9 3l-1 4 2 2-5 12h14l-5-12 2-2-1-4" /><path d="M9 3c1 1.5 5 1.5 6 0" />
			{:else}<path d="M4 16c0-5 3.5-9 8-9s8 4 8 9" /><path d="M3 16h18v3H3z" /><circle cx="12" cy="5" r="1.5" />{/if}
		</svg>
	{/if}
{/snippet}

{#if saved.length}
	<div class="{row ? 'no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1' : 'grid grid-cols-3 gap-2 sm:grid-cols-6'} {cls}" data-no-swipe>
		{#each saved as f, i (f.key)}
			<!-- A woven label: cream with a stitched edge, sewn on a little crooked. -->
			<div
				class="size-label relative flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-[6px] bg-cream px-2.5 pt-2 pb-2.5 text-center text-cocoa-950 shadow-[0_2px_0_0_var(--color-edge)] {row ? 'min-w-[5.5rem] max-w-[10rem]' : ''}"
				style="rotate: {i % 2 ? 1.5 : -1.5}deg"
			>
				<span class="text-rust-500">{@render glyph(f.key)}</span>
				<span class="text-[9px] font-bold tracking-widest uppercase opacity-60">{f.label.replace(' & jeans', '')}</span>
				<span class="display max-w-full truncate text-[17px] leading-tight">{sizes[f.key]}</span>
			</div>
		{/each}
	</div>
{/if}
