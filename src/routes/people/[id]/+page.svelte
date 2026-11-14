<script lang="ts">
	import PaperStrip from '#lib/components/PaperStrip.svelte';
	import EmptyArt from '#lib/components/EmptyArt.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import GiverShelf from '#lib/components/GiverShelf.svelte';
	import SwipePages from '#lib/components/SwipePages.svelte';
	import { countdownLabel, formatDate, occasionDate, occasionMeta, withKid } from '#lib/format.ts';
	import { askForIdeas, looksThin } from '#lib/nudge.ts';
	import { toast } from '#lib/undo.svelte.ts';
	import { dur } from '#lib/motion.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let active = $state(data.start);
	const first = $derived(data.person.name.split(' ')[0]);
	const pageIds = $derived(data.pages.map((p) => p.id));
	// Their next occasion, and whether the wish list for it looks thin: then offer to ask them.
	const soonest = $derived(data.soon);
	const thin = $derived(!!soonest && looksThin(soonest.gifts, soonest.days));
	async function nudge() {
		const r = await askForIdeas(data.person.name, soonest ? { label: soonest.label, kid: soonest.kid } : null);
		if (r === 'copied') toast('Message copied: paste it to them');
	}

	function followChip(id: string) {
		document.querySelector(`[data-chip="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: dur(1) ? 'smooth' : 'auto' });
	}
</script>

<svelte:head><title>{first}’s wish list · The Giver</title></svelte:head>

{#if data.person.paper}<PaperStrip wrap={data.person.paper} height="h-10 sm:h-12" class="-mt-3 mb-3 sm:mt-0" />{/if}
<!-- Compact header: back, their picture and name, and their birthday. -->
<section class="mb-4 flex items-center gap-3">
	<a href="/people" class="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cocoa-850 text-fg active:scale-95" aria-label="People"><Icon name="chevron-left" size={22} /></a>
	<Avatar name={data.person.name} src={data.person.avatar_url} sticker={data.person.sticker} size={48} />
	<div class="min-w-0">
		<h1 class="display truncate text-[28px] leading-tight sm:text-[40px]">{first}’s wish lists</h1>
		{#if data.person.birthday}<p class="text-sm font-bold text-rust-300">Birthday {countdownLabel(occasionDate('birthday', data.person.birthday))}</p>{/if}
	</div>
</section>

{#if thin && soonest}
	<!-- Their day is close and the list is thin: ask them for ideas (however you usually talk). -->
	<div class="mb-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-mustard-400/12 p-3 pl-4 ring-2 ring-mustard-400/30">
		<Icon name="sparkle" size={20} class="shrink-0 text-mustard-400" />
		<p class="min-w-0 flex-1 text-sm text-fg-muted"><span class="font-bold text-fg">{withKid(soonest.kid, soonest.label)}</span> is {(countdownLabel(soonest.date) ?? 'soon').toLowerCase()}, and {soonest.gifts === 0 ? 'there are no ideas yet' : soonest.gifts === 1 ? 'there’s only 1 idea so far' : `there are only ${soonest.gifts} ideas so far`}.</p>
		<button class="btn-primary min-h-10 shrink-0 px-3 text-sm" onclick={nudge}>Ask for ideas</button>
	</div>
{/if}

<div class="sticky top-[var(--header-h)] z-30 -mx-4 mb-3 flex gap-1.5 overflow-x-auto bg-cocoa-950 px-4 py-2  sm:mx-0 sm:flex-wrap sm:px-0 no-scrollbar" data-no-swipe>
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
			<GiverShelf dock={p.id === active ? 'tabs' : 'off'} items={p.items} categories={data.categories} giverName={data.giverName} error={form?.error ?? null} sizes={p.sizes} person={p.kid ?? data.person.name} />
		{:else}
			<div class="py-10 text-center"><EmptyArt class="mx-auto mb-3 opacity-80" /><p class="text-sm text-fg-faint">Nothing on this list yet.</p></div>
		{/if}
	{/snippet}
</SwipePages>
