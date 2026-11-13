<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductImage from './ProductImage.svelte';
	import Stars from './Stars.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import Sticker from './Sticker.svelte';
	import GiftTag from './GiftTag.svelte';
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

	const catById = $derived(new Map(categories.map((c) => [c.id, c])));
	const visible = $derived(hideTaken ? items.filter((i) => i.claimed < i.quantity || i.mine > 0) : items);
	const claimingItem = $derived(items.find((i) => i.id === claimingId));
	// Each claim sheet needs its own form id when several of these are on one page.
	const uid = $props.id();
	const formId = `claim-${uid}`;
</script>

<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
	{#each visible as item, i (item.id)}
		{@const taken = item.claimed >= item.quantity && item.mine === 0}
		{@const category = item.category_id ? catById.get(item.category_id) : undefined}
		{@const fresh = celebrating === item.id}
		<article class="card rise relative flex flex-col transition {taken ? 'opacity-50' : ''}" style="--i: {i}">
			<div class="relative p-2 pb-0">
				<ProductImage src={item.image_url} alt={item.title} class="aspect-square w-full rounded-[12px]" />
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
			<div class="flex flex-1 flex-col gap-2.5 p-3.5">
				<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-bold">
					{#if category}<span class="inline-flex min-w-0 items-center gap-1 truncate" style="color: {category.color}"><Icon name={category.icon} size={14} />{category.name}</span>{:else}<span></span>{/if}
					{#if item.rating}<Stars value={item.rating} size={13} />{/if}
				</div>
				<h3 class="line-clamp-2 text-[15px] leading-snug font-bold">{item.title}</h3>
				{#if item.specifics.length || item.quantity > 1}
					<div class="flex flex-wrap gap-1.5">
						{#each item.specifics as s, i (i)}<span class="pill"><span class="text-fg-faint">{s.label}</span>{s.value}</span>{/each}
						{#if item.quantity > 1}<span class="pill">{item.claimed}/{item.quantity} taken</span>{/if}
					</div>
				{/if}
				{#if item.note}<p class="text-xs text-fg-muted italic">“{item.note}”</p>{/if}
				<div class="mt-auto space-y-3 pt-1">
					<div class="flex items-center justify-between gap-2">
						{#if item.price_cents != null}<GiftTag tone="cream">{formatPrice(item.price_cents, item.currency)}</GiftTag>{:else}<span></span>{/if}
						{#if item.url}
							<a href={item.url} target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-fg-faint hover:text-teal-300">{item.store ?? 'Shop'}<Icon name="external" size={12} /></a>
						{/if}
					</div>
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
