<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import PaperStrip from '#lib/components/PaperStrip.svelte';
	import GiverGifts from '#lib/components/GiverGifts.svelte';
	import SwipePages from '#lib/components/SwipePages.svelte';
	import { countdownLabel, formatDate, milestone, occasionDate, occasionMeta } from '#lib/format.ts';
	import { dur } from '#lib/motion.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let hideTaken = $state(false);
	let active = $state('all');
	const pages = $derived(['all', ...data.lists.map((l) => l.id)]);
	const total = $derived(data.lists.reduce((n, l) => n + l.items.length, 0));
	const listsOn = (id: string) => (id === 'all' ? data.lists : data.lists.filter((l) => l.id === id));

	function followChip(id: string) {
		document.querySelector(`[data-chip="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: dur(1) ? 'smooth' : 'auto' });
	}
</script>

<svelte:head><title>{data.ownerName ? `${data.ownerName}’s wish lists` : 'Wish lists'} · The Giver</title></svelte:head>

<section class="mb-6 text-center">
	<p class="text-sm font-bold text-mustard-400">Everything on the wish list</p>
	<h1 class="display mt-1 text-[38px] leading-[1.08] sm:text-5xl">{data.ownerName ? `${data.ownerName}’s wish lists` : 'Wish lists'}</h1>
	<p class="mx-auto mt-4 max-w-md text-sm text-fg-muted">
		{total}
		{total === 1 ? 'gift' : 'gifts'} across {data.lists.length}
		{data.lists.length === 1 ? 'list' : 'lists'}. Pick something and tap <span class="font-bold text-teal-300">I’ll get this</span> so nobody doubles up. Shh, it stays a surprise.
	</p>
</section>

{#if data.lists.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-850 text-mustard-400"><Icon name="gift" size={30} /></div>
		<h2 class="display text-2xl">Nothing wrapped yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">There aren’t any gifts on these lists yet. Check back soon.</p>
	</div>
{:else}
	<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" data-no-swipe>
			{#each pages as id (id)}
				{@const list = data.lists.find((l) => l.id === id)}
				<button class="chip shrink-0 {active === id ? 'chip-on' : 'hover:text-fg'}" data-chip={id} aria-pressed={active === id} onclick={() => (active = id)}>
					{#if list}<Icon name={occasionMeta(list.occasion).icon} size={15} />{list.name}{:else}Everything{/if}
				</button>
			{/each}
		</div>
		<label class="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 self-end text-sm font-bold text-fg-muted sm:self-auto">
			<input type="checkbox" class="h-5 w-5 rounded-md border-2 border-cocoa-600 bg-sunken text-teal-600 focus:ring-0 focus:ring-offset-0" bind:checked={hideTaken} />
			Hide taken
		</label>
	</div>
	{#if pages.length > 2}
		<p class="-mt-2 mb-4 text-xs text-fg-faint sm:hidden">Swipe to flip through the lists.</p>
	{/if}

	<SwipePages {pages} bind:active onchange={followChip}>
		{#snippet page(id)}
			<div class="space-y-10">
				{#each listsOn(id) as list (list.id)}
					{@const meta = occasionMeta(list.occasion)}
					{@const next = occasionDate(list.occasion, list.occasion_date)}
					{@const turning = milestone(list.occasion, list.occasion_date)}
					<section>
						<PaperStrip wrap={list.wrap} occasion={list.occasion} class="h-14! sm:h-16!" />
						<div class="mt-3 mb-4">
							<h2 class="display text-[26px] leading-tight sm:text-3xl">{list.name}</h2>
							<p class="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-bold text-fg-muted">
								<span class="inline-flex items-center gap-1.5"><Icon name={meta.icon} size={15} />{meta.label}</span>
								{#if next}<span class="text-cocoa-500">·</span><span>{formatDate(next)}</span><span class="text-rust-300">{countdownLabel(next)}{#if turning}&nbsp;· {turning}{/if}</span>{/if}
							</p>
							{#if list.description}<p class="mt-2 text-sm whitespace-pre-line text-fg-muted">{list.description}</p>{/if}
						</div>
						<GiverGifts items={list.items} categories={data.categories} giverName={data.giverName} error={form?.error ?? null} {hideTaken} />
					</section>
				{/each}
			</div>
		{/snippet}
	</SwipePages>
{/if}
