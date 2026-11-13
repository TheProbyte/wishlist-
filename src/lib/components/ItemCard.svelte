<script lang="ts">
	import Stars from './Stars.svelte';
	import ProductImage from './ProductImage.svelte';
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

<article class="card group relative flex h-full flex-col overflow-hidden transition duration-300 hover:border-ink-600">
	<button type="button" class="block text-left" onclick={onopen} aria-label="Edit {item.title}">
		<ProductImage src={item.image_url} alt={item.title} class="aspect-square w-full transition duration-500 group-hover:brightness-[1.02]" />
	</button>

	{#if position}
		<div class="absolute top-3 left-3 flex items-center gap-1">
			<span
				class="grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-bold tabular-nums shadow {position === 1
					? 'bg-gradient-to-br from-gold-300 to-gold-500 text-ink-950'
					: 'bg-ink-950/85 text-fg backdrop-blur'}"
				title="Rank">#{position}</span
			>
			{#if onmove}
				<div class="flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
					{#each [-1, 1] as const as d (d)}
						<button
							type="button"
							class="grid h-7 w-7 place-items-center rounded-full bg-ink-950/85 text-fg-muted backdrop-blur hover:text-fg"
							aria-label={d === -1 ? 'Move up' : 'Move down'}
							onclick={() => onmove(d)}
						>
							<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class={d === 1 ? 'rotate-180' : ''}><path d="M5 12l5-5 5 5" /></svg>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if item.availability === 'out_of_stock'}
		<span class="absolute top-3 right-3 rounded-full bg-ink-950/85 px-2.5 py-1 text-[11px] font-semibold text-red-300 backdrop-blur">Out of stock</span>
	{/if}

	<div class="flex flex-1 flex-col gap-3 p-4">
		<div class="flex items-center justify-between gap-2 text-xs">
			{#if category}
				<span class="inline-flex items-center gap-1.5 truncate font-medium" style="color: {category.color}">
					<span class="h-1.5 w-1.5 shrink-0 rounded-full" style="background: {category.color}"></span>{category.name}
				</span>
			{:else}
				<span></span>
			{/if}
			{#if item.store}
				{#if item.url}
					<a href={item.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 truncate text-fg-faint hover:text-gold-300">
						{item.store}
						<svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" /></svg>
					</a>
				{:else}
					<span class="truncate text-fg-faint">{item.store}</span>
				{/if}
			{/if}
		</div>

		<button type="button" class="text-left" onclick={onopen}>
			<h3 class="line-clamp-2 text-[15px] leading-snug font-medium text-fg">{item.title}</h3>
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
			<p class="line-clamp-2 text-xs text-fg-faint italic">“{item.note}”</p>
		{/if}

		<div class="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1">
			<span class="text-lg font-semibold tabular-nums">{formatPrice(item.price_cents, item.currency) || '—'}</span>
			<Stars value={item.rating} size={15} onchange={onrate} />
		</div>
	</div>
</article>
