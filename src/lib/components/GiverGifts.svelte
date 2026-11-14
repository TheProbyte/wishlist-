<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductImage from './ProductImage.svelte';
	import Stars from './Stars.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import Sticker from './Sticker.svelte';
	import Confetti from './Confetti.svelte';
	import { formatPrice, hasPriceDrop } from '#lib/format.ts';
	import { paperFor } from '#lib/papers.ts';
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
	const catIcon = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.icon ?? null) : null);

	// Tap a gift for everything about it: big photo, their note, sizes, the shop, and claiming.
	let detailId = $state<string | null>(null);
	let detailOpen = $state(false);
	const detail = $derived(items.find((i) => i.id === detailId));
	function openDetail(id: string) {
		detailId = id;
		detailOpen = true;
	}
	function claim(id: string) {
		claimingId = id;
		nameOpen = true;
	}
	// Each claim sheet needs its own form id when several of these are on one page.
	const uid = $props.id();
	const formId = `claim-${uid}`;
</script>

<div class="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
	{#each visible as item, i (item.id)}
		{@const taken = item.claimed >= item.quantity && item.mine === 0}
		{@const fresh = celebrating === item.id}
		<article class="gift-hover card rise relative flex flex-col transition {taken ? 'opacity-50' : ''}" style="--i: {i}">
			<button type="button" class="relative block p-1.5 pb-0 text-left sm:p-2 sm:pb-0" aria-label="More about {item.title}" onclick={() => openDetail(item.id)}>
				<ProductImage src={item.image_url} alt={item.title} size={280} icon={catIcon(item.category_id)} seed={item.id} class="aspect-square w-full rounded-[12px]" />
				{#if item.mine > 0}
					<!-- Yours: wrapped in a teal ribbon. -->
					<div class="pointer-events-none absolute inset-x-2 top-2 bottom-0 overflow-hidden rounded-[12px]" aria-hidden="true">
						<div class="absolute inset-x-0 top-[46%] h-4 bg-teal-500 {fresh ? 'ribbon-x' : ''}" style={fresh ? 'animation-delay: 620ms' : ''}></div>
						<div class="absolute inset-y-0 left-[62%] w-4 bg-teal-500 {fresh ? 'ribbon-y' : ''}" style={fresh ? 'animation-delay: 800ms' : ''}></div>
						{#if fresh}<div class="wrap-up paper-grain absolute inset-0" style="background: {paperFor(null, 'general').background}"></div>{/if}
					</div>
				{/if}
				{#if fresh}<Confetti {fire} />{/if}
			</button>
			{#if item.mine > 0}
				<Sticker tone="teal" tilt={-5} class="absolute top-3.5 left-3.5 {fresh ? 'stamp' : ''}">You’re getting this</Sticker>
			{:else if taken}
				<Sticker tone="cocoa" tilt={-5} class="absolute top-3.5 left-3.5">Taken</Sticker>
			{/if}
			{#if hasPriceDrop(item) && !taken}
				<Sticker tone="mustard" tilt={5} class="absolute top-3.5 right-3.5">Price drop</Sticker>
			{/if}
			<div class="flex flex-1 flex-col gap-1.5 p-2.5 pt-2 sm:gap-2 sm:p-3.5 sm:pt-3">
				<button type="button" class="text-left" onclick={() => openDetail(item.id)}>
					<h3 class="line-clamp-2 text-[14px] leading-snug font-bold sm:text-[15px]">{item.title}</h3>
				</button>
				{#if item.specifics.length || item.quantity > 1}
					<div class="flex flex-wrap gap-1">
						{#each item.specifics.slice(0, 3) as s, i (i)}<span class="pill">{s.value}</span>{/each}
						{#if item.quantity > 1}<span class="pill">{item.claimed}/{item.quantity} taken</span>{/if}
					</div>
				{/if}
				{#if item.note}<p class="line-clamp-2 text-xs text-fg-muted italic">“{item.note}”</p>{/if}
				<div class="mt-auto space-y-2 pt-0.5">
					<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
						<span class="price-tag text-[14px] font-bold tabular-nums sm:text-base">{formatPrice(item.price_cents, item.currency) || '—'}</span>
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
						<button class="btn-teal w-full text-sm" onclick={() => claim(item.id)}>I’ll get this</button>
					{/if}
				</div>
			</div>
		</article>
	{/each}
</div>


<!-- One gift, in full. Opens part-way; drag it up to see everything. -->
<Modal bind:open={detailOpen} expandable>
	{#snippet header()}
		<div class="flex items-center justify-between px-5 pt-2 sm:px-6 sm:pt-4">
			<span class="text-xs font-bold tracking-wider text-fg-faint uppercase">Gift</span>
			<button type="button" class="btn-quiet -mr-2 w-11 px-0" aria-label="Close" onclick={() => (detailOpen = false)}><Icon name="close" size={20} /></button>
		</div>
	{/snippet}
	{#if detail}
		{@const taken = detail.claimed >= detail.quantity && detail.mine === 0}
		<div class="-mt-3">
			<div class="relative">
				<ProductImage src={detail.image_url} alt={detail.title} size={640} icon={catIcon(detail.category_id)} seed={detail.id} class="aspect-[4/3] w-full rounded-[18px]" />
				<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
					{#if detail.mine > 0}<Sticker tone="teal" tilt={-4}>You’re getting this</Sticker>{:else if taken}<Sticker tone="cocoa" tilt={-4}>Taken</Sticker>{/if}
					{#if detail.availability === 'out_of_stock'}<Sticker tone="rust" tilt={3}>Sold out</Sticker>{:else if hasPriceDrop(detail)}<Sticker tone="mustard" tilt={3}>Price drop</Sticker>{/if}
				</div>
			</div>
			<h2 class="display mt-4 text-[26px] leading-tight break-words">{detail.title}</h2>
			<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
				<span class="flex items-baseline gap-2">
					{#if detail.price_cents != null}<span class="text-2xl font-bold tabular-nums">{formatPrice(detail.price_cents, detail.currency)}</span>{/if}
					{#if hasPriceDrop(detail)}<s class="text-sm text-fg-faint tabular-nums">{formatPrice(detail.prev_price_cents, detail.currency)}</s>{/if}
				</span>
				{#if detail.rating}<span class="flex items-center gap-2 text-xs font-bold text-fg-faint">How much they want it <Stars value={detail.rating} size={16} /></span>{/if}
			</div>

			{#if detail.note}
				<blockquote class="mt-4 rounded-[16px] bg-cocoa-850 px-4 py-3 text-[15px] italic text-fg">“{detail.note}”</blockquote>
			{/if}

			{#if detail.specifics.length || detail.quantity > 1}
				<dl class="mt-4 grid grid-cols-2 gap-2">
					{#each detail.specifics as sp, i (i)}
						<div class="rounded-[14px] bg-cocoa-850 px-3.5 py-2.5"><dt class="text-xs font-bold text-fg-faint">{sp.label}</dt><dd class="font-bold">{sp.value}</dd></div>
					{/each}
					{#if detail.quantity > 1}
						<div class="rounded-[14px] bg-cocoa-850 px-3.5 py-2.5"><dt class="text-xs font-bold text-fg-faint">Wants</dt><dd class="font-bold">{detail.quantity} · {detail.claimed} taken</dd></div>
					{/if}
				</dl>
			{/if}

			{#if detail.description}
				<h3 class="mt-5 mb-1.5 text-sm font-bold text-fg-faint">About it</h3>
				<p class="text-sm leading-relaxed whitespace-pre-line text-fg-muted">{detail.description}</p>
			{/if}

			{#if detail.url}
				<a href={detail.url} target="_blank" rel="noopener noreferrer" class="btn-ghost mt-5 w-full">See it at {detail.store ?? 'the shop'}<Icon name="external" size={15} /></a>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		{#if detail}
			{@const taken = detail.claimed >= detail.quantity && detail.mine === 0}
			{#if preview}
				<p class="text-center text-sm text-fg-muted">Givers tap <span class="font-bold text-teal-300">I’ll get this</span> here.</p>
			{:else if detail.mine > 0}
				<form method="POST" action="?/unclaim" use:enhance={() => async ({ update }) => { await update(); detailOpen = false; }}>
					<input type="hidden" name="id" value={detail.id} />
					<button class="btn-ghost w-full">You’re getting this · Undo</button>
				</form>
			{:else if taken}
				<p class="text-center text-sm font-bold text-fg-muted">Someone’s already getting this one.</p>
			{:else}
				<button class="btn-teal w-full" onclick={() => { const id = detail.id; detailOpen = false; setTimeout(() => claim(id), 200); }}>I’ll get this</button>
			{/if}
		{/if}
	{/snippet}
</Modal>

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
