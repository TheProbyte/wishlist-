<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductImage from './ProductImage.svelte';
	import Stars from './Stars.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import Sticker from './Sticker.svelte';
	import Confetti from './Confetti.svelte';
	import { formatPrice, hasPriceDrop } from '#lib/format.ts';
	import type { Category, Item } from '#lib/types.ts';

	type GiverItem = Item & { claimed: number; mine: number };

	/** The giver's view of gifts: claim one, see what's taken, undo. Used by both kinds of share link. */
	let {
		items,
		categories,
		giverName,
		error = null,
		hideTaken = false,
		preview = false
	}: { items: GiverItem[]; categories: Category[]; giverName: string; error?: string | null; hideTaken?: boolean; preview?: boolean } = $props();

	let claimingId = $state<string | null>(null);
	let nameOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let name = $state(giverName);
	// The gift just claimed, and a counter that launches its confetti.
	let celebrating = $state<string | null>(null);
	let fire = $state(0);

	const visible = $derived(hideTaken ? items.filter((i) => i.claimed < i.quantity || i.mine > 0) : items);
	const claimingItem = $derived(items.find((i) => i.id === claimingId));
	// Each claim sheet needs its own form id when several of these are on one page.
	const uid = $props.id();
	const formId = `claim-${uid}`;
</script>

<div class="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
	{#each visible as item, i (item.id)}
		{@const taken = item.claimed >= item.quantity && item.mine === 0}
		{@const fresh = celebrating === item.id}
		<article class="card rise relative flex flex-col transition {taken ? 'opacity-50' : ''}" style="--i: {i}">
			<div class="relative p-1.5 pb-0 sm:p-2 sm:pb-0">
				<ProductImage src={item.image_url} alt={item.title} size={280} class="aspect-square w-full rounded-[12px]" />
				{#if item.mine > 0}
					<!-- Yours: wrapped in a teal ribbon. -->
					<div class="pointer-events-none absolute inset-x-2 top-2 bottom-0 overflow-hidden rounded-[12px]" aria-hidden="true">
						<div class="absolute inset-x-0 top-[46%] h-4 bg-teal-500 {fresh ? 'ribbon-x' : ''}"></div>
						<div class="absolute inset-y-0 left-[62%] w-4 bg-teal-500 {fresh ? 'ribbon-y' : ''}"></div>
					</div>
				{/if}
				{#if fresh}<Confetti {fire} />{/if}
			</div>
			{#if item.mine > 0}
				<Sticker tone="teal" tilt={-5} class="absolute top-3.5 left-3.5 {fresh ? 'stamp' : ''}">You’re getting this</Sticker>
			{:else if taken}
				<Sticker tone="cocoa" tilt={-5} class="absolute top-3.5 left-3.5">Taken</Sticker>
			{/if}
			{#if hasPriceDrop(item) && !taken}
				<Sticker tone="mustard" tilt={5} class="absolute top-3.5 right-3.5">Price drop</Sticker>
			{/if}
			<div class="flex flex-1 flex-col gap-1.5 p-2.5 pt-2 sm:gap-2 sm:p-3.5 sm:pt-3">
				<h3 class="line-clamp-2 text-[14px] leading-snug font-bold sm:text-[15px]">{item.title}</h3>
				{#if item.specifics.length || item.quantity > 1}
					<div class="flex flex-wrap gap-1">
						{#each item.specifics.slice(0, 3) as s, i (i)}<span class="pill">{s.value}</span>{/each}
						{#if item.quantity > 1}<span class="pill">{item.claimed}/{item.quantity} taken</span>{/if}
					</div>
				{/if}
				{#if item.note}<p class="line-clamp-2 text-xs text-fg-muted italic">“{item.note}”</p>{/if}
				<div class="mt-auto space-y-2 pt-0.5">
					<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
						<span class="text-[15px] font-bold tabular-nums sm:text-lg">{formatPrice(item.price_cents, item.currency) || '—'}</span>
						{#if item.rating}<Stars value={item.rating} size={13} />{/if}
					</div>
					{#if item.url}
						<a href={item.url} target="_blank" rel="noopener noreferrer" class="-my-1 flex min-h-9 items-center gap-1 truncate text-xs font-bold text-fg-faint hover:text-teal-300"><span class="truncate">{item.store ?? 'See it in the shop'}</span><Icon name="external" size={12} /></a>
					{/if}
					{#if preview}
						<!-- The owner's preview: no claiming. -->
					{:else if item.mine > 0}
						<form method="POST" action="?/unclaim" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<button class="btn-ghost w-full text-sm">Undo</button>
						</form>
					{:else if !taken}
						<button
							class="btn-teal w-full text-sm"
							onclick={() => {
								claimingId = item.id;
								nameOpen = true;
							}}>I’ll get this</button
						>
					{/if}
				</div>
			</div>
		</article>
	{/each}
</div>

<Modal bind:open={nameOpen} title="I’ll get this">
	<form
		id={formId}
		method="POST"
		action="?/claim"
		use:enhance={() => async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				nameOpen = false;
				celebrating = claimingId;
				fire++;
			}
		}}
	>
		<input type="hidden" name="id" value={claimingId} />
		{#if claimingItem}
			<p class="mb-5 text-sm text-fg-muted">Marking <span class="font-bold text-fg">{claimingItem.title}</span> as yours. Other givers will see it’s taken. The list owner won’t.</p>
		{/if}
		<label class="block">
			<span class="label">Your name</span>
			<input class="field" name="name" required maxlength="40" placeholder="So other givers know" bind:value={name} />
		</label>
		{#if error && nameOpen}<p class="mt-3 text-sm font-bold text-rust-300">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (nameOpen = false)}>Cancel</button>
			<button form={formId} class="btn-teal">It’s mine</button>
		</div>
	{/snippet}
</Modal>
