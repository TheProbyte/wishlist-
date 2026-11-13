<script lang="ts">
	import Stars from './Stars.svelte';
	import ProductImage from './ProductImage.svelte';
	import Sticker from './Sticker.svelte';
	import Icon from './Icon.svelte';
	import { formatPrice } from '#lib/format.ts';
	import type { Category, Item } from '#lib/types.ts';

	let {
		item,
		category,
		position,
		onopen,
		onrate,
		onmove
	}: {
		item: Item;
		category?: Category;
		/** 1-based rank shown when sorted by most wanted. */
		position?: number;
		onopen: () => void;
		onrate?: (rating: number) => void;
		onmove?: (delta: -1 | 1) => void;
	} = $props();
</script>

<!-- Gift cards stay plain (cream photo tile, cocoa body) so the products are the colour. -->
<article class="card group relative flex h-full flex-col overflow-hidden">
	<button type="button" class="block p-2 pb-0 text-left" onclick={onopen} aria-label="Edit {item.title}">
		<ProductImage src={item.image_url} alt={item.title} class="aspect-square w-full rounded-[12px]" />
	</button>

	{#if position}
		<div class="absolute top-3.5 left-3.5 flex items-center gap-1">
			<Sticker tone={position === 1 ? 'mustard' : 'cocoa'} tilt={position % 2 ? -5 : 4}>#{position}</Sticker>
			{#if onmove}
				<div class="ml-1 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
					{#each [-1, 1] as const as d (d)}
						<button type="button" class="grid h-8 w-8 place-items-center rounded-full bg-cocoa-950/85 text-fg hover:bg-cocoa-950" aria-label={d === -1 ? 'Move up' : 'Move down'} onclick={() => onmove(d)}>
							<Icon name={d === -1 ? 'chevron-up' : 'chevron-down'} size={16} />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if item.availability === 'out_of_stock'}
		<Sticker tone="rust" tilt={5} class="absolute top-3.5 right-3.5">Sold out</Sticker>
	{/if}

	<div class="flex flex-1 flex-col gap-2.5 p-3.5">
		<div class="flex items-center justify-between gap-2 text-xs font-bold">
			{#if category}
				<span class="inline-flex min-w-0 items-center gap-1 truncate" style="color: {category.color}"><Icon name={category.icon} size={14} />{category.name}</span>
			{:else}
				<span></span>
			{/if}
			{#if item.store}
				{#if item.url}
					<a href={item.url} target="_blank" rel="noopener noreferrer" class="inline-flex min-w-0 items-center gap-1 truncate text-fg-faint hover:text-mustard-400">
						{item.store}<Icon name="external" size={12} />
					</a>
				{:else}
					<span class="truncate text-fg-faint">{item.store}</span>
				{/if}
			{/if}
		</div>

		<button type="button" class="text-left" onclick={onopen}>
			<h3 class="line-clamp-2 text-[15px] leading-snug font-bold text-fg">{item.title}</h3>
		</button>

		{#if item.specifics.length || item.quantity > 1}
			<div class="flex flex-wrap gap-1.5">
				{#each item.specifics.slice(0, 4) as s, i (i)}
					<span class="pill"><span class="text-fg-faint">{s.label}</span>{s.value}</span>
				{/each}
				{#if item.quantity > 1}<span class="pill">× {item.quantity}</span>{/if}
			</div>
		{/if}

		{#if item.note}
			<p class="line-clamp-2 text-xs text-fg-muted italic">“{item.note}”</p>
		{/if}

		<div class="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1">
			<span class="text-lg font-bold tabular-nums">{formatPrice(item.price_cents, item.currency) || '—'}</span>
			<Stars value={item.rating} size={16} onchange={onrate} />
		</div>
	</div>
</article>
