<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import GiverShelf from '#lib/components/GiverShelf.svelte';
	import SwipePages from '#lib/components/SwipePages.svelte';
	import { countdownLabel, formatDate, occasionDate, occasionMeta } from '#lib/format.ts';
	import { dur } from '#lib/motion.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let active = $state(data.start);
	const first = $derived(data.person.name.split(' ')[0]);
	const pageIds = $derived(data.pages.map((p) => p.id));
	function followChip(id: string) {
		document.querySelector(`[data-chip="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: dur(1) ? 'smooth' : 'auto' });
	}
</script>

<svelte:head><title>{first}’s wish list · The Giver</title></svelte:head>

<a href="/people" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />People</a>

<section class="mb-6 flex items-center gap-4">
	<Avatar name={data.person.name} src={data.person.avatar_url} size={64} />
	<div class="min-w-0">
		<h1 class="display truncate text-[34px] leading-tight sm:text-[42px]">{first}’s wish lists</h1>
		{#if data.person.birthday}<p class="text-sm font-bold text-rust-300">Birthday {countdownLabel(occasionDate('birthday', data.person.birthday))}</p>{/if}
	</div>
</section>

<div class="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 no-scrollbar" data-no-swipe>
	{#each data.pages as p (p.id)}
		<button class="chip shrink-0 {active === p.id ? 'chip-on' : 'hover:text-fg'}" data-chip={p.id} aria-pressed={active === p.id} onclick={() => (active = p.id)}>
			<Icon name={p.kid && p.label === p.kid ? 'teddy' : p.label === 'Everything' ? 'gift' : occasionMeta(p.occasion).icon} size={15} />{p.label}
		</button>
	{/each}
</div>

<SwipePages pages={pageIds} bind:active onchange={followChip}>
	{#snippet page(id)}
		{@const p = data.pages.find((x) => x.id === id)!}
		{@const next = p.label === 'Everything' || (p.kid && p.label === p.kid) ? null : occasionDate(p.occasion, p.occasion_date)}
		{#if next}
			<p class="mb-4 text-sm font-bold text-fg-muted">{formatDate(next)} · <span class="text-rust-300">{countdownLabel(next)}</span></p>
		{/if}
		{#if p.items.length}
			<GiverShelf items={p.items} categories={data.categories} giverName={data.giverName} error={form?.error ?? null} sizes={p.sizes} person={p.kid ?? data.person.name} />
		{:else}
			<p class="py-14 text-center text-sm text-fg-faint">Nothing on this list yet.</p>
		{/if}
	{/snippet}
</SwipePages>
