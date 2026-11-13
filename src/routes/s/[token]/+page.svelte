<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import PaperStrip from '#lib/components/PaperStrip.svelte';
	import GiverShelf from '#lib/components/GiverShelf.svelte';
	import { countdownLabel, formatDate, milestone, occasionDate, occasionMeta } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const meta = $derived(occasionMeta(data.list.occasion));
	const isEverything = $derived(data.list.kind === 'master');
	const nextDate = $derived(isEverything ? null : occasionDate(data.list.occasion, data.list.occasion_date));
	const turning = $derived(milestone(data.list.occasion, data.list.occasion_date));
	const first = $derived(data.person?.split(' ')[0] ?? null);
	const title = $derived(isEverything ? (first ? `${first}’s wish list` : 'Wish list') : data.list.name);
</script>

<svelte:head><title>{title} · The Giver</title></svelte:head>

<section class="mb-8">
	<PaperStrip wrap={data.list.wrap ?? (isEverything ? 'sunburst' : null)} occasion={data.list.occasion} />
	<div class="mt-6 text-center">
		<p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-bold text-fg-muted">
			{#if isEverything}
				<span class="inline-flex items-center gap-1.5"><Icon name="gift" size={16} />Everything {first ?? 'they'}’d love</span>
			{:else}
				{#if first}<span>{first}’s</span>{/if}
				<span class="inline-flex items-center gap-1.5"><Icon name={meta.icon} size={16} />{meta.label}</span>
				{#if nextDate}
					<span class="text-cocoa-500">·</span><span>{formatDate(nextDate)}</span>
					<span class="text-rust-300">{countdownLabel(nextDate)}{#if turning}&nbsp;· {turning}{/if}</span>
				{/if}
			{/if}
		</p>
		<h1 class="display mt-2 text-[38px] leading-[1.08] sm:text-5xl">{title}</h1>
		{#if data.list.description}
			<p class="mx-auto mt-4 max-w-xl whitespace-pre-line text-fg-muted">{data.list.description}</p>
		{/if}
		{#if !data.isOwner}
			<p class="mx-auto mt-5 max-w-md text-sm text-fg-muted">Pick something and tap <span class="font-bold text-teal-300">I’ll get this</span> so nobody buys the same gift twice. Shh, it stays a surprise.</p>
		{/if}
	</div>
</section>

<GiverShelf items={data.items} categories={data.categories} giverName={data.giverName} error={form?.error ?? null} sizes={data.sizes} person={data.person} preview={data.isOwner} />
