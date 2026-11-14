<script lang="ts">
	import Stars from './Stars.svelte';
	import ProductImage from './ProductImage.svelte';
	import Sticker from './Sticker.svelte';
	import Icon from './Icon.svelte';
	import { formatPrice, hasPriceDrop } from '#lib/format.ts';
	import type { Item } from '#lib/types.ts';

	/**
	 * One gift: photo, name, price and stars, with size/colour as small pills. The shop, notes and
	 * the rest live in the gift's sheet. `layout="row"` is the compact one-per-line version.
	 */
	let {
		item,
		position,
		onopen,
		onrate,
		onstep,
		layout = 'grid',
		selected = null
	}: {
		item: Item;
		/** 1-based rank shown when sorted by most wanted. */
		position?: number;
		onopen: () => void;
		onrate?: (rating: number) => void;
		/** Reorder mode: move up or down one place with clear buttons. */
		onstep?: (delta: -1 | 1) => void;
		layout?: 'grid' | 'row';
		/** In select mode: whether this card is ticked (null when not selecting). */
		selected?: boolean | null;
	} = $props();

	const soldOut = $derived(item.availability === 'out_of_stock');
	const dropped = $derived(hasPriceDrop(item));
	const pills = $derived([...item.specifics.slice(0, layout === 'row' ? 2 : 3).map((s) => s.value), ...(item.quantity > 1 ? [`× ${item.quantity}`] : [])]);
</script>

{#snippet tick()}
	<!-- Select mode: the whole card is one big tick box. -->
	<button type="button" class="absolute inset-0 z-10 cursor-pointer {selected ? 'bg-mustard-400/10' : ''}" aria-pressed={selected} aria-label="{selected ? 'Untick' : 'Tick'} {item.title}" onclick={onopen}></button>
	<span class="pointer-events-none absolute z-10 grid h-7 w-7 place-items-center rounded-full border-2 shadow-[0_2px_0_0_var(--color-edge)] transition {layout === 'row' ? 'top-1/2 right-3 -translate-y-1/2' : 'top-3 right-3'} {selected ? 'border-mustard-400 bg-mustard-400 text-cocoa-950' : 'border-cream/80 bg-cocoa-950/60'}">
		{#if selected}<Icon name="check" size={16} />{/if}
	</span>
{/snippet}

{#snippet price(cls: string)}
	<span class="flex items-baseline gap-1.5">
		<span class="font-bold tabular-nums {cls}">{formatPrice(item.price_cents, item.currency) || '—'}</span>
		{#if dropped}<s class="text-[11px] text-fg-faint tabular-nums">{formatPrice(item.prev_price_cents, item.currency)}</s>{/if}
	</span>
{/snippet}

{#if layout === 'row'}
	<article class="gift-hover card relative flex items-center gap-3 p-2 pr-3 select-none [-webkit-touch-callout:none] {selected ? 'ring-3 ring-mustard-400' : ''}">
		{#if selected !== null}{@render tick()}{/if}
		<button type="button" class="relative shrink-0" onclick={onopen} aria-label="Open {item.title}" data-photo>
			<ProductImage src={item.image_url} alt="" size={64} class="h-16 w-16 rounded-[10px] {soldOut ? 'opacity-60' : ''}" />
			{#if position}<span class="absolute -top-1 -left-1 grid h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] font-bold shadow-[0_2px_0_0_var(--color-edge)] {position === 1 ? 'bg-mustard-400 text-cocoa-950' : 'bg-cocoa-950 text-fg'}">{position}</span>{/if}
		</button>
		<div class="min-w-0 flex-1 {selected !== null ? 'pr-8' : ''}">
			<button type="button" class="block w-full text-left" onclick={onopen}>
				<h3 class="line-clamp-2 text-[14px] leading-snug font-bold text-fg">{item.title}</h3>
			</button>
			<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
				{@render price('text-[14px]')}
				{#if soldOut}<span class="pill bg-rust-500 text-cream">Sold out</span>{:else if dropped}<span class="pill bg-mustard-400 text-cocoa-950">Price drop</span>{/if}
				{#each pills as p, i (i)}<span class="pill">{p}</span>{/each}
				{#if !onstep && selected === null}<Stars value={item.rating} size={14} onchange={onrate} />{/if}
			</div>
		</div>
		{#if onstep}
			<div class="flex shrink-0 flex-col gap-1">
				<button type="button" class="grid h-9 w-9 place-items-center rounded-full bg-cocoa-800 text-fg active:scale-95" aria-label="Move {item.title} up" onclick={() => onstep(-1)}><Icon name="chevron-up" size={18} /></button>
				<button type="button" class="grid h-9 w-9 place-items-center rounded-full bg-cocoa-800 text-fg active:scale-95" aria-label="Move {item.title} down" onclick={() => onstep(1)}><Icon name="chevron-down" size={18} /></button>
			</div>
		{/if}
	</article>
{:else}
	<!-- Gift cards stay plain (cream photo tile, cocoa body) so the products are the colour. -->
	<article class="gift-hover card relative flex h-full flex-col overflow-hidden select-none [-webkit-touch-callout:none] {selected ? 'ring-3 ring-mustard-400' : ''}">
		{#if selected !== null}{@render tick()}{/if}
		<button type="button" class="block p-1.5 pb-0 text-left sm:p-2 sm:pb-0" onclick={onopen} aria-label="Open {item.title}" data-photo>
			<ProductImage src={item.image_url} alt="" size={280} class="aspect-square w-full rounded-[12px] {soldOut ? 'opacity-60' : ''}" />
		</button>

		{#if position}
			<Sticker tone={position === 1 ? 'mustard' : 'cocoa'} tilt={position % 2 ? -5 : 4} class="absolute top-3 left-3">#{position}</Sticker>
		{/if}
		{#if selected === null}
			{#if soldOut}
				<Sticker tone="rust" tilt={5} class="absolute top-3 right-3">Sold out</Sticker>
			{:else if dropped}
				<Sticker tone="mustard" tilt={5} class="absolute top-3 right-3">Price drop</Sticker>
			{/if}
		{/if}

		<div class="flex flex-1 flex-col gap-1.5 p-2.5 pt-2 sm:gap-2 sm:p-3.5 sm:pt-3">
			<button type="button" class="text-left" onclick={onopen}>
				<h3 class="line-clamp-2 text-[14px] leading-snug font-bold text-fg sm:text-[15px]">{item.title}</h3>
			</button>
			{#if pills.length}
				<div class="flex flex-wrap gap-1">
					{#each pills as p, i (i)}<span class="pill">{p}</span>{/each}
				</div>
			{/if}
			<div class="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-0.5">
				<span class="price-tag">{@render price('text-[14px] sm:text-base')}</span>
				<Stars value={item.rating} size={14} onchange={onrate} />
			</div>
		</div>
	</article>
{/if}
