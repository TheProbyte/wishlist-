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

<!-- Compact header: a strip of the list's paper, the name, one line of facts. -->
<section class="mb-5 sm:mb-7">
	<PaperStrip wrap={data.list.wrap ?? (isEverything ? 'sunburst' : null)} occasion={data.list.occasion} height="h-[52px] sm:h-20" class="-mt-3 sm:mt-0" />
	<div class="mt-4 text-center">
		<h1 class="display text-[30px] leading-[1.08] break-words sm:text-5xl">{title}</h1>
		<p class="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm font-bold text-fg-muted">
			{#if isEverything}
				<span class="inline-flex items-center gap-1.5"><Icon name="gift" size={15} />Everything {first ?? 'they'}’d love</span>
			{:else}
				<span class="inline-flex items-center gap-1.5"><Icon name={meta.icon} size={15} />{first ? `${first}’s ${meta.label}` : meta.label}</span>
				{#if nextDate}
					<span class="text-cocoa-500">·</span><span>{formatDate(nextDate)}</span>
					<span class="text-rust-300">{countdownLabel(nextDate)}{#if turning}&nbsp;· {turning}{/if}</span>
				{/if}
			{/if}
		</p>
		{#if data.list.description}
			<p class="mx-auto mt-3 max-w-xl text-sm whitespace-pre-line text-fg-muted">{data.list.description}</p>
		{/if}
		{#if !data.isOwner}
			<p class="mx-auto mt-3 max-w-md text-[13px] text-fg-faint">Tap <span class="font-bold text-teal-300">I’ll get this</span> so nobody buys the same gift twice. Shh, it stays a surprise.</p>
		{/if}
	</div>
</section>

<GiverShelf items={data.items} categories={data.categories} giverName={data.giverName} error={form?.error ?? null} sizes={data.sizes} person={data.person} preview={data.isOwner} sticky />
