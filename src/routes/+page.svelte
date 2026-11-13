<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import { countdownLabel, daysUntil, formatDate, occasionMeta } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let creating = $state(false);
	let busy = $state(false);
</script>

<svelte:head><title>Your lists · The Giver</title></svelte:head>

<section class="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<p class="mb-2 text-sm font-medium text-gold-400">Hi {data.lists.length ? 'again' : 'there'} 👋</p>
		<h1 class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
			Your <span class="ribbon-text">wish lists</span>
		</h1>
		<p class="mt-3 max-w-md text-fg-muted">Paste a link from any shop and it fills itself in. Rank what you want most, and share it with the people buying.</p>
	</div>
	{#if data.lists.length}
		<button class="btn-primary self-start sm:self-auto" onclick={() => (creating = true)}>
			<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 4v12M4 10h12" /></svg>
			New list
		</button>
	{/if}
</section>

{#if data.lists.length === 0}
	<div class="card relative overflow-hidden px-6 py-16 text-center sm:px-12">
		<div class="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-[36rem] rounded-full bg-gold-500/10 blur-3xl"></div>
		<div class="relative">
			<div class="mb-5 text-5xl">🎁</div>
			<h2 class="font-display text-2xl font-semibold">Start your first list</h2>
			<p class="mx-auto mt-2 max-w-sm text-fg-muted">A birthday, Christmas, or just things you’d love someday.</p>
			<button class="btn-primary mt-7" onclick={() => (creating = true)}>Create a list</button>
		</div>
	</div>
{:else}
	<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.lists as list (list.id)}
			{@const meta = occasionMeta(list.occasion)}
			{@const days = daysUntil(list.occasion_date)}
			<a
				href="/lists/{list.id}"
				class="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-ink-600"
			>
				<div class="relative grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-ink-800">
					{#if list.covers.length === 0}
						<div class="col-span-2 row-span-2 grid place-items-center bg-gradient-to-br from-ink-800 to-ink-850 text-5xl opacity-80">
							{meta.icon}
						</div>
					{:else}
						{#each list.covers as src, i (i)}
							<div
								class="bg-white {list.covers.length === 1 ? 'col-span-2 row-span-2' : ''} {list.covers.length === 2 ? 'row-span-2' : ''} {list
									.covers.length === 3 && i === 0
									? 'row-span-2'
									: ''}"
							>
								<img {src} alt="" loading="lazy" referrerpolicy="no-referrer" class="h-full w-full object-contain p-2 transition duration-500 group-hover:scale-105" />
							</div>
						{/each}
					{/if}
					{#if days != null && days >= 0 && days <= 60}
						<span class="absolute top-3 left-3 rounded-full bg-ink-950/85 px-2.5 py-1 text-xs font-semibold text-gold-300 backdrop-blur">
							{countdownLabel(list.occasion_date)}
						</span>
					{/if}
				</div>
				<div class="flex flex-1 items-center justify-between gap-4 px-5 py-4">
					<div class="min-w-0">
						<h3 class="truncate font-semibold">{list.name}</h3>
						<p class="mt-0.5 truncate text-sm text-fg-faint">
							{meta.icon} {meta.label}{#if list.occasion_date}&nbsp;· {formatDate(list.occasion_date)}{/if}
						</p>
					</div>
					<div class="shrink-0 text-right">
						<div class="text-lg font-semibold tabular-nums">{list.item_count}</div>
						<div class="text-[11px] tracking-wide text-fg-faint uppercase">{list.item_count === 1 ? 'gift' : 'gifts'}</div>
					</div>
				</div>
			</a>
		{/each}
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
		{#if form?.error}<p class="mt-4 text-sm text-red-300">{form.error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (creating = false)}>Cancel</button>
			<button form="new-list" class="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create list'}</button>
		</div>
	{/snippet}
</Modal>
