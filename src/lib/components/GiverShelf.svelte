<script lang="ts">
	import GiverGifts from './GiverGifts.svelte';
	import Icon from './Icon.svelte';
	import { SIZE_FIELDS } from '#lib/sizes.ts';
	import type { Category, Item, Sizes } from '#lib/types.ts';

	type GiverItem = Item & { claimed: number; mine: number };

	/**
	 * What a giver browses: filters (category, price), the person's sizes, and the gifts.
	 * `preview` is the owner looking at their own link: no claiming, no claim marks.
	 */
	let {
		items,
		categories,
		giverName,
		error = null,
		sizes = {},
		person = null,
		preview = false,
		sticky = false
	}: {
		items: GiverItem[];
		categories: Category[];
		giverName: string;
		error?: string | null;
		sizes?: Sizes;
		person?: string | null;
		preview?: boolean;
		/** Stick the toolbar under the header (not inside a swipe strip, where it can't stick). */
		sticky?: boolean;
	} = $props();

	const PRICES = [
		{ id: 'u25', label: 'Under $25', test: (c: number) => c < 2500 },
		{ id: '25-50', label: '$25–50', test: (c: number) => c >= 2500 && c < 5000 },
		{ id: '50-100', label: '$50–100', test: (c: number) => c >= 5000 && c < 10000 },
		{ id: '100', label: '$100+', test: (c: number) => c >= 10000 }
	];

	let category = $state('all');
	let price = $state('any');
	let hideTaken = $state(false);
	let priceOpen = $state(false);

	const usedCategories = $derived(categories.filter((c) => items.some((i) => i.category_id === c.id)));
	const usedPrices = $derived(PRICES.filter((p) => items.some((i) => i.price_cents != null && p.test(i.price_cents))));
	const shown = $derived(
		items.filter(
			(i) =>
				(category === 'all' || i.category_id === category) &&
				(price === 'any' || (i.price_cents != null && PRICES.find((p) => p.id === price)!.test(i.price_cents)))
		)
	);
	const savedSizes = $derived(SIZE_FIELDS.filter((f) => sizes[f.key]?.trim()));
	const takenCount = $derived(items.filter((i) => i.claimed >= i.quantity).length);
</script>

<svelte:window onclick={() => (priceOpen = false)} onkeydown={(e) => e.key === 'Escape' && (priceOpen = false)} />

{#if preview}
	<div class="mb-4 flex gap-3 rounded-[var(--radius-card)] bg-teal-600/25 px-4 py-3 text-sm text-teal-300">
		<Icon name="gift" size={20} />
		<span><span class="font-bold">This is what givers see.</span> Who’s getting what is hidden from you, so it stays a surprise.</span>
	</div>
{/if}

{#if savedSizes.length}
	<div class="card no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto px-3.5 py-2.5 whitespace-nowrap" data-no-swipe>
		<span class="flex shrink-0 items-center gap-2 pr-1 text-sm font-bold"><Icon name="shirt" size={18} class="text-rust-300" />{person ? `${person.split(' ')[0]}’s sizes` : 'Sizes'}</span>
		{#each savedSizes as f (f.key)}
			<span class="pill shrink-0 text-xs"><span class="text-fg-faint">{f.label}</span>{sizes[f.key]}</span>
		{/each}
	</div>
{/if}

<!-- One toolbar: categories, price and "hide taken". On a share link it sticks under the header. -->
<div class="{sticky ? 'sticky top-[76px] z-30 -mx-4 bg-cocoa-950 px-4 py-2  sm:mx-0 sm:px-0' : ''} mb-3 flex items-center gap-2">
	<div class="no-scrollbar -my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pr-4 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]" data-no-swipe>
		{#if usedCategories.length > 1}
			<button class="chip shrink-0 {category === 'all' ? 'chip-on' : 'hover:text-fg'}" aria-pressed={category === 'all'} onclick={() => (category = 'all')}>All</button>
			{#each usedCategories as c (c.id)}
				<button class="chip shrink-0 {category === c.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={category === c.id} onclick={() => (category = category === c.id ? 'all' : c.id)}>
					<Icon name={c.icon} size={15} />{c.name}
				</button>
			{/each}
		{:else}
			<span class="self-center text-sm font-bold text-fg-faint">{items.length} {items.length === 1 ? 'gift' : 'gifts'}{#if !preview && takenCount}&nbsp;· {takenCount} taken{/if}</span>
		{/if}
	</div>
	{#if usedPrices.length > 1}
		<div class="relative shrink-0">
			<button
				class="chip px-3 hover:text-fg {price !== 'any' ? 'chip-on' : ''}"
				aria-haspopup="menu"
				aria-expanded={priceOpen}
				onclick={(e) => {
					e.stopPropagation();
					priceOpen = !priceOpen;
				}}>{PRICES.find((p) => p.id === price)?.label ?? 'Any price'}<Icon name="chevron-down" size={14} /></button
			>
			{#if priceOpen}
				<div role="menu" tabindex="-1" class="menu-in origin-top-right absolute top-full right-0 z-40 mt-2 w-44 rounded-[16px] bg-cocoa-850 p-1.5 shadow-[0_4px_0_0_var(--color-edge),0_16px_40px_-10px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
					{#each [{ id: 'any', label: 'Any price' }, ...usedPrices] as p (p.id)}
						<button role="menuitemradio" aria-checked={price === p.id} class="flex min-h-11 w-full items-center justify-between rounded-[10px] px-3 text-left text-sm font-bold {price === p.id ? 'bg-cocoa-800 text-fg' : 'text-fg-muted hover:text-fg'}" onclick={() => { price = p.id; priceOpen = false; }}>
							{p.label}{#if price === p.id}<Icon name="check" size={16} class="text-mustard-400" />{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	{#if !preview && takenCount}
		<button class="chip shrink-0 px-3 {hideTaken ? 'chip-on' : 'hover:text-fg'}" aria-pressed={hideTaken} onclick={() => (hideTaken = !hideTaken)}>
			<Icon name={hideTaken ? 'check' : 'gift'} size={15} /><span class="max-[379px]:sr-only">Hide taken</span>
		</button>
	{/if}
</div>

<GiverGifts items={shown} {categories} {giverName} {error} {hideTaken} {preview} />
{#if shown.length === 0}
	<p class="py-14 text-center text-sm text-fg-faint">Nothing here at that price. Try another.</p>
{/if}
