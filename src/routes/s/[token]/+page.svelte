<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import PaperStrip from '#lib/components/PaperStrip.svelte';
	import GiverGifts from '#lib/components/GiverGifts.svelte';
	import { countdownLabel, formatDate, milestone, occasionDate, occasionMeta } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let hideTaken = $state(false);
	const meta = $derived(occasionMeta(data.list.occasion));
	const nextDate = $derived(occasionDate(data.list.occasion, data.list.occasion_date));
	const turning = $derived(milestone(data.list.occasion, data.list.occasion_date));
	const takenCount = $derived(data.items.filter((i) => i.claimed >= i.quantity).length);
</script>

<svelte:head><title>{data.list.name} · The Giver</title></svelte:head>

<section class="mb-8">
	<PaperStrip wrap={data.list.wrap} occasion={data.list.occasion} />
	<div class="mt-6 text-center">
		<p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-bold text-fg-muted">
			<span class="inline-flex items-center gap-1.5"><Icon name={meta.icon} size={16} />{meta.label}</span>
			{#if nextDate}
				<span class="text-cocoa-500">·</span><span>{formatDate(nextDate)}</span>
				<span class="text-rust-300">{countdownLabel(nextDate)}{#if turning}&nbsp;· {turning}{/if}</span>
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

<GiverGifts items={data.items} categories={data.categories} giverName={data.giverName} error={form?.error ?? null} {hideTaken} />
