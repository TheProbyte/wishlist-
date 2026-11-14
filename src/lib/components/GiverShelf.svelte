<script lang="ts">
	import EmptyArt from './EmptyArt.svelte';
	import GiverGifts from './GiverGifts.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import { enhance } from '$app/forms';
	import { SIZE_FIELDS } from '#lib/sizes.ts';
	import type { Category, GiverItem, Sizes } from '#lib/types.ts';


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
		sticky = false,
		dock = null,
		who = null
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
		/**
		 * Phones: the filters dock at the bottom, in thumb reach. 'tabs' above the tab bar, 'edge' at
		 * the bottom of the screen (share links have no tab bar), 'off' for a page that isn't the
		 * one showing (only one bar at a time). Null keeps them in place.
		 */
		dock?: 'tabs' | 'edge' | 'off' | null;
		/** Share links: who you're giving as, with a way to change it. */
		who?: { name: string } | null;
	} = $props();

	// The giver's name: shown in the bottom bar once known, and changeable there.
	let whoOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let whoName = $state(who?.name ?? '');

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
	const covered = (i: GiverItem) => i.price_cents != null && i.chipped > 0 && i.chipped >= i.price_cents;
	const takenByOthers = (i: GiverItem) => (i.claimed >= i.quantity || covered(i)) && i.mine === 0 && i.myChip === 0;
	const takenCount = $derived(items.filter(takenByOthers).length);
	// Most wanted: their top three still to give (or yours), big in a row above the rest, when
	// nothing's filtered and the list is long enough for it to help.
	const lane = $derived(category === 'all' && price === 'any' && items.length >= 6 ? items.filter((i) => !takenByOthers(i)).slice(0, 3) : []);
	const rest = $derived(lane.length ? shown.filter((i) => !lane.includes(i)) : shown);
</script>


{#if preview}
	<div class="mb-4 flex gap-3 rounded-[var(--radius-card)] bg-teal-600/25 px-4 py-3 text-sm text-teal-300">
		<Icon name="gift" size={20} />
		<span><span class="font-bold">This is your list, as givers see it.</span> Who’s getting what is hidden from you here, even when you’re signed out, so it stays a surprise.</span>
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

{#snippet filters()}
	<div class="no-scrollbar -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 pr-4 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]" data-no-swipe>
		{#if usedCategories.length > 1}
			<button class="chip shrink-0 {category === 'all' ? 'chip-on' : 'hover:text-fg'}" aria-pressed={category === 'all'} onclick={() => (category = 'all')}>All</button>
			{#each usedCategories as c (c.id)}
				<button class="chip shrink-0 {category === c.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={category === c.id} onclick={() => (category = category === c.id ? 'all' : c.id)}>
					<Icon name={c.icon} size={15} />{c.name}
				</button>
			{/each}
		{/if}
		{#if usedPrices.length > 1}
			{#if usedCategories.length > 1}<span class="mx-0.5 h-5 w-0.5 shrink-0 rounded-full bg-cocoa-700" aria-hidden="true"></span>{/if}
			<!-- Price: chips to tap, right there. -->
			{#each usedPrices as pr (pr.id)}
				<button class="chip shrink-0 {price === pr.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={price === pr.id} onclick={() => (price = price === pr.id ? 'any' : pr.id)}>{pr.label}</button>
			{/each}
		{/if}
		{#if !preview && takenCount}
			<button class="chip shrink-0 px-3 {hideTaken ? 'chip-on' : 'hover:text-fg'}" aria-pressed={hideTaken} onclick={() => (hideTaken = !hideTaken)}>
				<Icon name={hideTaken ? 'check' : 'gift'} size={15} />Hide taken
			</button>
		{/if}
		{#if usedCategories.length <= 1 && usedPrices.length <= 1}
			<span class="self-center text-sm font-bold text-fg-faint">{items.length} {items.length === 1 ? 'gift' : 'gifts'}{#if !preview && takenCount}&nbsp;· {takenCount} taken{/if}</span>
		{/if}
	</div>
{/snippet}

{#snippet whoLine()}
	{#if who && !preview}
		<button class="flex min-h-9 w-full items-center gap-2 px-2 text-left text-[13px] text-fg-muted" onclick={() => (whoOpen = true)}>
			<Icon name="user" size={15} class="shrink-0 text-teal-300" />
			{#if who.name}<span class="min-w-0 flex-1 truncate">Giving as <span class="font-bold text-fg">{who.name}</span></span><span class="shrink-0 font-bold text-teal-300">Change</span>
			{:else}<span class="min-w-0 flex-1 truncate">Pick a gift and tap <span class="font-bold text-teal-300">I’ll get this</span></span>{/if}
		</button>
	{/if}
{/snippet}

<!-- The filters. In place on bigger screens (sticking under the header on a share link); on
     phones they can dock at the bottom, in thumb reach. -->
<div class="{dock ? 'max-sm:hidden' : ''} {sticky ? 'sticky top-[var(--header-h)] z-30 -mx-4 bg-cocoa-950 px-4 py-2 sm:mx-0 sm:px-0' : ''} mb-3 flex flex-col gap-1">
	<div class="flex items-center gap-2">{@render filters()}</div>
	{#if who && !preview}<div class="hidden sm:block">{@render whoLine()}</div>{/if}
</div>
{#if dock === 'tabs' || dock === 'edge'}
	<div class="fixed inset-x-3 z-30 sm:hidden {dock === 'tabs' ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'}">
		<div class="rounded-[var(--radius-card)] bg-cocoa-900 p-1.5 shadow-[0_3px_0_0_var(--color-edge),0_12px_32px_-8px_rgb(0_0_0/0.75)] ring-2 ring-cocoa-700">
			{@render whoLine()}
			<div class="flex items-center gap-2">{@render filters()}</div>
		</div>
	</div>
{/if}

<GiverGifts items={rest} {lane} {categories} giverName={who?.name || giverName} {error} {hideTaken} {preview} />
{#if who}
	<Modal bind:open={whoOpen} title="Who’s giving?">
		<form
			id="who-form"
			method="POST"
			action="?/name"
			use:enhance={() => async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') whoOpen = false;
			}}
		>
			<p class="mb-4 text-sm text-fg-muted">Other givers see this name on the gifts you take, so nobody doubles up. The list owner never does.</p>
			<label class="block">
				<span class="label">Your name</span>
				<input class="field" name="name" required maxlength="40" bind:value={whoName} />
			</label>
		</form>
		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<button type="button" class="btn-quiet" onclick={() => (whoOpen = false)}>Cancel</button>
				<button form="who-form" class="btn-teal">Save</button>
			</div>
		{/snippet}
	</Modal>
{/if}
{#if shown.length === 0}
	<div class="py-10 text-center"><EmptyArt class="mx-auto mb-3 opacity-80" /><p class="text-sm text-fg-faint">Nothing here at that price. Try another.</p></div>
{/if}
