<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import Present from '#lib/components/Present.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { countdownLabel, daysUntil, formatDate, occasionMeta } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let creating = $state(false);
	let busy = $state(false);

	const next = $derived(data.lists.find((l) => l.id === data.nextId) ?? null);
	const gifts = (n: number) => `${n} ${n === 1 ? 'gift' : 'gifts'}`;
</script>

<svelte:head><title>Your lists · The Giver</title></svelte:head>

<section class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<p class="mb-1 text-[15px] font-bold text-mustard-400">{data.lists.length ? 'Hey again!' : 'Hey there!'}</p>
		<h1 class="display text-[40px] leading-[1.05] text-fg sm:text-5xl">Your wish lists</h1>
	</div>
	{#if data.lists.length}
		<button class="btn-primary self-start sm:self-auto" onclick={() => (creating = true)}>
			<Icon name="plus" size={18} />
			New list
		</button>
	{/if}
</section>

{#if data.lists.length === 0}
	<div class="card overflow-hidden">
		<Present occasion="birthday" class="h-40" />
		<div class="px-6 py-10 text-center">
			<h2 class="display text-2xl">Nothing wrapped yet</h2>
			<p class="mx-auto mt-2 max-w-sm text-fg-muted">Start a list for a birthday, Christmas, or things you’d love someday.</p>
			<button class="btn-primary mt-6" onclick={() => (creating = true)}>Make your first list</button>
		</div>
	</div>
{:else}
	{#if next}
		{@const days = daysUntil(next.occasion_date) ?? 0}
		<a href="/lists/{next.id}" class="card mb-9 flex overflow-hidden transition active:translate-y-0.5">
			<Present wrap={next.wrap} occasion={next.occasion} ribbonAt={50} class="w-[30%] shrink-0 sm:w-64" />
			<div class="flex min-w-0 flex-1 items-center justify-between gap-3 py-4 pr-3.5 pl-4 sm:p-6">
				<div class="min-w-0">
					<p class="text-xs font-bold tracking-wider text-rust-300 uppercase">Next up</p>
					<h2 class="display mt-1 line-clamp-2 text-[22px] leading-tight break-words sm:text-3xl">{next.name}</h2>
					<p class="mt-1 text-sm text-fg-muted">{gifts(next.item_count)} · {formatDate(next.occasion_date)}</p>
				</div>
				<div class="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-cocoa-950 text-center sm:h-24 sm:w-24">
					<div>
						<div class="display text-[28px] leading-none text-mustard-400 sm:text-4xl">{days}</div>
						<div class="text-[11px] font-bold text-fg-muted">{days === 1 ? 'day' : 'days'}</div>
					</div>
				</div>
			</div>
		</a>
	{/if}

	<div class="mb-4 flex items-baseline justify-between">
		<h2 class="text-lg font-bold">All lists</h2>
	</div>
	<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
		{#each data.lists as list (list.id)}
			{@const meta = occasionMeta(list.occasion)}
			{@const days = daysUntil(list.occasion_date)}
			<a href="/lists/{list.id}" class="card group flex flex-col overflow-hidden transition active:translate-y-0.5">
				<Present wrap={list.wrap} occasion={list.occasion} class="aspect-[4/3]">
					<GiftTag tilt={-6} class="absolute bottom-3 left-3">{gifts(list.item_count)}</GiftTag>
				</Present>
				<div class="flex flex-1 flex-col gap-0.5 px-3.5 pt-3 pb-3.5">
					<h3 class="truncate text-[15px] font-bold">{list.name}</h3>
					<p class="flex items-center gap-1.5 truncate text-[13px] text-fg-muted">
						<Icon name={meta.icon} size={14} />
						{#if list.occasion_date}
							<span class={days != null && days >= 0 && days <= 60 ? 'font-bold text-rust-300' : ''}>
								{days != null && days >= 0 && days <= 60 ? countdownLabel(list.occasion_date) : formatDate(list.occasion_date)}
							</span>
						{:else}
							{meta.label}
						{/if}
					</p>
				</div>
			</a>
		{/each}
		<button
			class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 text-fg-muted transition hover:border-mustard-400 hover:text-mustard-400"
			onclick={() => (creating = true)}
		>
			<Icon name="plus" size={26} />
			<span class="text-sm font-bold">New list</span>
		</button>
	</div>
{/if}

<Modal bind:open={creating} title="New list">
	<form
		id="new-list"
		method="POST"
		action="?/create"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<ListForm />
		{#if form?.error}<p class="mt-4 text-sm font-bold text-rust-300">{form.error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (creating = false)}>Cancel</button>
			<button form="new-list" class="btn-primary" disabled={busy}>{busy ? 'Wrapping…' : 'Make list'}</button>
		</div>
	{/snippet}
</Modal>
