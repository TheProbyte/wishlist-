<script lang="ts">
	import ProductImage from './ProductImage.svelte';
	import Stars from './Stars.svelte';
	import Sticker from './Sticker.svelte';
	import Rosette from './Rosette.svelte';
	import Icon from './Icon.svelte';
	import { formatDate, formatPrice, hasPriceDrop } from '#lib/format.ts';
	import type { Category, Item } from '#lib/types.ts';

	/**
	 * One of your gifts, shown properly before any editing: the big photo, its price on a tag,
	 * your hearts, your note, the details, which lists it's on and where to buy it. Used as a
	 * sheet on phones and as the side panel on wide screens.
	 */
	let {
		item,
		category,
		position,
		lists,
		onedit,
		onrate,
		onclose
	}: {
		item: Item;
		category?: Category;
		position?: number;
		/** Names of the occasion lists it's on (it's always in Everything). */
		lists: string[];
		onedit: () => void;
		onrate: (rating: number) => void;
		/** Shown as a close button (the side panel; the sheet has its own). */
		onclose?: () => void;
	} = $props();

	const soldOut = $derived(item.availability === 'out_of_stock');
	const dropped = $derived(hasPriceDrop(item));
	const added = $derived(formatDate(new Date(item.created_at * 1000).toISOString().slice(0, 10)));
	// The full shop name is kept at the top of the notes when the title was shortened.
	const about = $derived(item.description?.trim() ?? '');
</script>

<div class="space-y-4">
	<div class="relative">
		<ProductImage src={item.image_url} alt={item.title} size={520} icon={category?.icon} seed={item.id} class="aspect-[4/3] w-full rounded-[18px] {soldOut ? 'opacity-70' : ''}" />
		<div class="absolute top-2.5 left-2.5 flex items-start gap-1.5">
			{#if position && position <= 3}<Rosette place={position as 1 | 2 | 3} size={42} class="-rotate-6" />{:else if position}<Sticker tone="cocoa" tilt={-4}>#{position}</Sticker>{/if}
		</div>
		<div class="absolute top-3 right-3 flex flex-col items-end gap-1.5">
			{#if soldOut}<Sticker tone="rust" tilt={4}>Sold out</Sticker>{:else if dropped}<Sticker tone="mustard" tilt={4}>Price drop</Sticker>{/if}
		</div>
		{#if onclose}
			<button class="absolute right-2.5 bottom-2.5 grid h-9 w-9 place-items-center rounded-full bg-cocoa-950/85 text-fg shadow-[0_2px_0_0_var(--color-edge)] hover:text-mustard-400" aria-label="Close" onclick={onclose}><Icon name="close" size={18} /></button>
		{/if}
	</div>

	<div>
		{#if category}<p class="mb-1 inline-flex items-center gap-1.5 text-xs font-bold" style="color: {category.color}"><Icon name={category.icon} size={14} />{category.name}</p>{/if}
		<h2 class="display text-[24px] leading-tight break-words">{item.title}</h2>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<span class="flex items-baseline gap-2">
			{#if item.price_cents != null}
				<span class="price-tag text-xl font-bold tabular-nums">{formatPrice(item.price_cents, item.currency)}</span>
				{#if dropped}<s class="text-sm text-fg-faint tabular-nums">{formatPrice(item.prev_price_cents, item.currency)}</s>{/if}
			{:else}
				<span class="text-sm text-fg-faint">No price yet</span>
			{/if}
		</span>
		<span class="flex items-center gap-2 text-xs font-bold text-fg-faint">How much <Stars value={item.rating} size={20} onchange={onrate} /></span>
	</div>

	{#if item.note}
		<blockquote class="selectable rounded-[16px] bg-cocoa-850 px-4 py-3 text-[15px] text-fg italic">“{item.note}”</blockquote>
	{/if}

	{#if item.specifics.length || item.quantity > 1}
		<dl class="grid grid-cols-2 gap-2">
			{#each item.specifics as sp, i (i)}
				<div class="rounded-[14px] bg-cocoa-850 px-3.5 py-2.5"><dt class="text-xs font-bold text-fg-faint">{sp.label}</dt><dd class="font-bold">{sp.value}</dd></div>
			{/each}
			{#if item.quantity > 1}<div class="rounded-[14px] bg-cocoa-850 px-3.5 py-2.5"><dt class="text-xs font-bold text-fg-faint">Wanted</dt><dd class="font-bold">× {item.quantity}</dd></div>{/if}
		</dl>
	{/if}

	<div>
		<p class="mb-1.5 text-xs font-bold text-fg-faint">On</p>
		<div class="flex flex-wrap gap-1.5">
			<span class="pill bg-mustard-400/20 text-mustard-300"><Icon name="gift" size={12} />Everything</span>
			{#each lists as name (name)}<span class="pill">{name}</span>{/each}
		</div>
	</div>

	{#if about}
		<details class="group rounded-[14px] bg-cocoa-850 px-4 py-3">
			<summary class="cursor-pointer list-none text-sm font-bold text-fg-muted">About it <span class="text-fg-faint group-open:hidden">· show</span></summary>
			<p class="selectable mt-2 text-sm leading-relaxed whitespace-pre-line text-fg-muted">{about}</p>
		</details>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button class="btn-primary flex-1" onclick={onedit}><Icon name="tag" size={17} />Edit</button>
		{#if item.url}
			<a href={item.url} target="_blank" rel="noopener noreferrer" class="btn-ghost flex-1">{item.store ?? 'Shop'}<Icon name="external" size={15} /></a>
		{/if}
	</div>
	<p class="text-center text-xs text-fg-faint">Added {added}</p>
</div>
