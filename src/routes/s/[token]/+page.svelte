<script lang="ts">
	import { enhance } from '$app/forms';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Sticker from '#lib/components/Sticker.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import PaperStrip from '#lib/components/PaperStrip.svelte';
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

<section class="mb-8">
	<PaperStrip wrap={data.list.wrap} occasion={data.list.occasion} />
	<div class="mt-6 text-center">
		<p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-bold text-fg-muted">
			<span class="inline-flex items-center gap-1.5"><Icon name={meta.icon} size={16} />{meta.label}</span>
			{#if data.list.occasion_date}
				<span class="text-cocoa-500">·</span><span>{formatDate(data.list.occasion_date)}</span>
				<span class="text-rust-300">{countdownLabel(data.list.occasion_date)}</span>
			{/if}
		</p>
		<h1 class="display mt-2 text-[38px] leading-[1.08] sm:text-5xl">{data.list.name}</h1>
		{#if data.list.description}
			<p class="mx-auto mt-4 max-w-xl whitespace-pre-line text-fg-muted">{data.list.description}</p>
		{/if}
		<p class="mx-auto mt-5 max-w-md text-sm text-fg-muted">Pick something and tap <span class="font-bold text-teal-300">I’ll get this</span> so nobody buys the same gift twice. Shh, it stays a surprise.</p>
	</div>
</section>

<div class="mb-5 flex items-center justify-between text-sm">
	<span class="font-bold text-fg-faint">{data.items.length} gifts · {takenCount} taken</span>
	<label class="flex min-h-11 cursor-pointer items-center gap-2 font-bold text-fg-muted">
		<input type="checkbox" class="h-5 w-5 rounded-md border-2 border-cocoa-600 bg-sunken text-teal-600 focus:ring-0 focus:ring-offset-0" bind:checked={hideTaken} />
		Hide taken
	</label>
</div>

<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
	{#each visible as item (item.id)}
		{@const taken = item.claimed >= item.quantity && item.mine === 0}
		{@const category = item.category_id ? catById.get(item.category_id) : undefined}
		<article class="card relative flex flex-col overflow-hidden transition {taken ? 'opacity-50' : ''}">
			<div class="p-2 pb-0"><ProductImage src={item.image_url} alt={item.title} class="aspect-square w-full rounded-[12px]" /></div>
			{#if item.mine > 0}
				<Sticker tone="teal" tilt={-5} class="absolute top-3.5 left-3.5">You’re getting this</Sticker>
			{:else if taken}
				<Sticker tone="cocoa" tilt={-5} class="absolute top-3.5 left-3.5">Taken</Sticker>
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
					{#if item.mine > 0}
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
			<p class="mb-5 text-sm text-fg-muted">Marking <span class="font-bold text-fg">{claimingItem.title}</span> as yours. Other givers will see it’s taken. The list owner won’t.</p>
		{/if}
		<label class="block">
			<span class="label">Your name</span>
			<input class="field" name="name" required maxlength="40" placeholder="So other givers know" bind:value={name} />
		</label>
		{#if form?.error}<p class="mt-3 text-sm font-bold text-rust-300">{form.error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (nameOpen = false)}>Cancel</button>
			<button form="claim-form" class="btn-teal">It’s mine</button>
		</div>
	{/snippet}
</Modal>
