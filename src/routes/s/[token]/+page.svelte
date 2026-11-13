<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { countdownLabel, formatDate, formatPrice, occasionMeta } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let hideTaken = $state(false);
	let claimingId = $state<string | null>(null);
	let nameOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let name = $state(data.giverName);

	const meta = $derived(occasionMeta(data.list.occasion));
	const catById = $derived(new Map(data.categories.map((c) => [c.id, c])));
	const visible = $derived(hideTaken ? data.items.filter((i) => i.claimed < i.quantity || i.mine > 0) : data.items);
	const claimingItem = $derived(data.items.find((i) => i.id === claimingId));
	const takenCount = $derived(data.items.filter((i) => i.claimed >= i.quantity).length);
</script>

<svelte:head><title>{data.list.name} · The Giver</title></svelte:head>

<section class="mb-10 text-center">
	<p class="mb-3 text-sm text-fg-muted">
		{meta.icon} {meta.label}{#if data.list.occasion_date}&nbsp;· {formatDate(data.list.occasion_date)}
			<span class="ml-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-semibold text-gold-300">{countdownLabel(data.list.occasion_date)}</span>{/if}
	</p>
	<h1 class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{data.list.name}</h1>
	{#if data.list.description}
		<p class="mx-auto mt-4 max-w-xl whitespace-pre-line text-fg-muted">{data.list.description}</p>
	{/if}
	<p class="mx-auto mt-5 max-w-md text-sm text-fg-faint">Pick something and tap <span class="text-gold-300">I’ll get this</span>, so nobody buys the same gift twice. It stays a surprise.</p>
</section>

<div class="mb-6 flex items-center justify-between text-sm">
	<span class="text-fg-faint">{data.items.length} gifts · {takenCount} taken</span>
	<label class="flex cursor-pointer items-center gap-2 text-fg-muted">
		<input type="checkbox" class="rounded border-ink-500 bg-ink-800 text-gold-500 focus:ring-gold-500/30" bind:checked={hideTaken} />
		Hide taken
	</label>
</div>

<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
	{#each visible as item (item.id)}
		{@const taken = item.claimed >= item.quantity && item.mine === 0}
		{@const category = item.category_id ? catById.get(item.category_id) : undefined}
		<article class="card relative flex flex-col overflow-hidden transition {taken ? 'opacity-45' : ''}">
			<ProductImage src={item.image_url} alt={item.title} class="aspect-square w-full" />
			{#if item.mine > 0}
				<span class="absolute top-3 left-3 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-2.5 py-1 text-[11px] font-bold text-ink-950">You’re getting this</span>
			{:else if taken}
				<span class="absolute top-3 left-3 rounded-full bg-ink-950/85 px-2.5 py-1 text-[11px] font-semibold text-fg-muted backdrop-blur">Taken</span>
			{/if}
			<div class="flex flex-1 flex-col gap-3 p-4">
				<div class="flex items-center justify-between gap-2 text-xs">
					{#if category}<span class="truncate font-medium" style="color: {category.color}">{category.icon} {category.name}</span>{:else}<span></span>{/if}
					{#if item.rating}<Stars value={item.rating} size={12} />{/if}
				</div>
				<h3 class="line-clamp-2 text-[15px] leading-snug font-medium">{item.title}</h3>
				{#if item.specifics.length || item.quantity > 1}
					<div class="flex flex-wrap gap-1.5">
						{#each item.specifics as s, i (i)}<span class="pill"><span class="text-fg-faint">{s.label}</span>{s.value}</span>{/each}
						{#if item.quantity > 1}<span class="pill">{item.claimed}/{item.quantity} taken</span>{/if}
					</div>
				{/if}
				{#if item.note}<p class="text-xs text-fg-faint italic">“{item.note}”</p>{/if}
				<div class="mt-auto space-y-3 pt-1">
					<div class="flex items-center justify-between">
						<span class="text-lg font-semibold tabular-nums">{formatPrice(item.price_cents, item.currency) || '—'}</span>
						{#if item.url}
							<a href={item.url} target="_blank" rel="noopener noreferrer" class="text-xs text-fg-faint hover:text-gold-300">{item.store ?? 'Shop'} ↗</a>
						{/if}
					</div>
					{#if item.mine > 0}
						<form method="POST" action="?/unclaim" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<button class="btn-ghost w-full py-2 text-xs">Undo</button>
						</form>
					{:else if !taken}
						<button
							class="btn-primary w-full py-2 text-xs"
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
		id="claim-form"
		method="POST"
		action="?/claim"
		use:enhance={() => async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') nameOpen = false;
		}}
	>
		<input type="hidden" name="id" value={claimingId} />
		{#if claimingItem}
			<p class="mb-5 text-sm text-fg-muted">Marking <span class="text-fg">{claimingItem.title}</span> as yours. Other givers will see it’s taken; the list owner won’t.</p>
		{/if}
		<label class="block">
			<span class="label">Your name</span>
			<input class="field" name="name" required maxlength="40" placeholder="So other givers know" bind:value={name} />
		</label>
		{#if form?.error}<p class="mt-3 text-sm text-red-300">{form.error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (nameOpen = false)}>Cancel</button>
			<button form="claim-form" class="btn-primary">Mark as mine</button>
		</div>
	{/snippet}
</Modal>
