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
		preview = false
	}: {
		items: GiverItem[];
		categories: Category[];
		giverName: string;
		error?: string | null;
		sizes?: Sizes;
		person?: string | null;
		preview?: boolean;
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

{#if preview}
	<div class="mb-6 flex gap-3 rounded-[var(--radius-card)] bg-teal-600/25 px-4 py-3 text-sm text-teal-300">
		<Icon name="gift" size={20} />
		<span><span class="font-bold">This is what givers see.</span> Who’s getting what is hidden from you, so it stays a surprise.</span>
	</div>
{/if}

{#if savedSizes.length}
	<div class="card mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
		<span class="flex items-center gap-2 text-sm font-bold"><Icon name="shirt" size={18} class="text-rust-300" />{person ? `${person.split(' ')[0]}’s sizes` : 'Sizes'}</span>
		{#each savedSizes as f (f.key)}
			<span class="pill text-xs"><span class="text-fg-faint">{f.label}</span>{sizes[f.key]}</span>
		{/each}
	</div>
{/if}

<div class="mb-5 space-y-3">
	{#if usedCategories.length > 1}
		<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" data-no-swipe>
			<button class="chip shrink-0 {category === 'all' ? 'chip-on' : 'hover:text-fg'}" aria-pressed={category === 'all'} onclick={() => (category = 'all')}>All</button>
			{#each usedCategories as c (c.id)}
				<button class="chip shrink-0 {category === c.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={category === c.id} onclick={() => (category = category === c.id ? 'all' : c.id)}>
					<Icon name={c.icon} size={15} />{c.name}
				</button>
			{/each}
		</div>
	{/if}
	<div class="flex flex-wrap items-center justify-between gap-3">
		{#if usedPrices.length > 1}
			<div class="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-no-swipe>
				<div class="flex shrink-0 gap-1 rounded-[var(--radius-control)] bg-sunken p-1">
					<button class="min-h-9 rounded-[10px] px-3 text-[13px] font-bold whitespace-nowrap {price === 'any' ? 'bg-cocoa-700 text-fg' : 'text-fg-faint hover:text-fg'}" aria-pressed={price === 'any'} onclick={() => (price = 'any')}>Any price</button>
					{#each usedPrices as p (p.id)}
						<button class="min-h-9 rounded-[10px] px-3 text-[13px] font-bold whitespace-nowrap {price === p.id ? 'bg-cocoa-700 text-fg' : 'text-fg-faint hover:text-fg'}" aria-pressed={price === p.id} onclick={() => (price = p.id)}>{p.label}</button>
					{/each}
				</div>
			</div>
		{:else}
			<span></span>
		{/if}
		{#if !preview}
			<label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-fg-muted">
				<span class="text-fg-faint">{items.length} gifts · {takenCount} taken</span>
				<input type="checkbox" class="ml-2 h-5 w-5 rounded-md border-2 border-cocoa-600 bg-sunken text-teal-600 focus:ring-0 focus:ring-offset-0" bind:checked={hideTaken} />
				Hide taken
			</label>
		{/if}
	</div>
</div>

<GiverGifts items={shown} {categories} {giverName} {error} {hideTaken} {preview} />
{#if shown.length === 0}
	<p class="py-14 text-center text-sm text-fg-faint">Nothing here at that price. Try another.</p>
{/if}
