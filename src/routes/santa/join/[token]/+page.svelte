<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Present from '#lib/components/Present.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import { formatDate, formatPrice } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Join {data.exchange.name} · The Giver</title></svelte:head>

<div class="mx-auto max-w-md">
	<div class="card overflow-hidden">
		<Present occasion="christmas" ribbonAt={50} class="h-40 rounded-t-[var(--radius-card)]" />
		<div class="p-6 text-center">
			<p class="text-sm font-bold text-rust-300">{data.exchange.organiser.split(' ')[0]} invited you to a Secret Santa</p>
			<h1 class="display mt-1 text-[34px] leading-tight">{data.exchange.name}</h1>
			<div class="mt-3 flex flex-wrap justify-center gap-2">
				{#if data.exchange.budget_cents}<GiftTag tone="mustard">{formatPrice(data.exchange.budget_cents, data.exchange.currency)} budget</GiftTag>{/if}
				{#if data.exchange.exchange_date}<GiftTag>{formatDate(data.exchange.exchange_date)}</GiftTag>{/if}
			</div>
			<div class="mt-4 flex justify-center -space-x-2">
				{#each data.members.slice(0, 10) as m, i (i)}<Avatar name={m.name} src={m.avatar_url} size={40} />{/each}
			</div>
			{#if data.exchange.drawn_at}
				<p class="mt-6 text-sm font-bold text-rust-300">Names have already been drawn. Ask {data.exchange.organiser.split(' ')[0]} to reopen it.</p>
			{:else}
				<form method="POST" class="mt-6"><button class="btn-primary w-full">Count me in</button></form>
				<p class="mt-3 text-xs text-fg-faint">Once names are drawn you’ll see who you’re buying for, and their wish list.</p>
			{/if}
		</div>
	</div>
</div>
