<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import ItemEditor, { type Draft } from '#lib/components/ItemEditor.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import { countdownLabel, formatDate, formatPrice, occasionMeta } from '#lib/format.ts';
	import type { ImportResult, Item } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Sort = 'rank' | 'rating' | 'price_asc' | 'price_desc' | 'newest';
	const SORTS: { value: Sort; label: string }[] = [
		{ value: 'rank', label: 'Most wanted' },
		{ value: 'rating', label: 'Rating' },
		{ value: 'price_asc', label: 'Price ↑' },
		{ value: 'price_desc', label: 'Price ↓' },
		{ value: 'newest', label: 'Newest' }
	];

	let sort = $state<Sort>('rank');
	let filter = $state<string>('all');
	// Writable derived: follows the server data, but can be reordered locally while dragging.
	let items = $derived(data.items);

	const catById = $derived(new Map(data.categories.map((c) => [c.id, c])));
	const usedCategories = $derived(
		data.categories
			.map((c) => ({ ...c, count: items.filter((i) => i.category_id === c.id).length }))
			.filter((c) => c.count > 0)
	);
	const visible = $derived.by(() => {
		let list = filter === 'all' ? items : items.filter((i) => (filter === 'none' ? !i.category_id : i.category_id === filter));
		const byPrice = (i: Item) => i.price_cents ?? (sort === 'price_asc' ? Infinity : -Infinity);
		if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating || a.rank - b.rank);
		if (sort === 'price_asc') list = [...list].sort((a, b) => byPrice(a) - byPrice(b));
		if (sort === 'price_desc') list = [...list].sort((a, b) => byPrice(b) - byPrice(a));
		if (sort === 'newest') list = [...list].sort((a, b) => b.created_at - a.created_at);
		return list;
	});
	const canReorder = $derived(sort === 'rank' && filter === 'all');

	const totals = $derived.by(() => {
		const by = new Map<string, number>();
		for (const i of items) if (i.price_cents != null) by.set(i.currency ?? 'USD', (by.get(i.currency ?? 'USD') ?? 0) + i.price_cents * i.quantity);
		return [...by.entries()].sort((a, b) => b[1] - a[1]);
	});

	const meta = $derived(occasionMeta(data.list.occasion));
	const shareUrl = $derived(data.list.share_token ? `${page.url.origin}/s/${data.list.share_token}` : null);

	/* ------------------------------------------------ adding & editing */

	let link = $state('');
	let editorOpen = $state(false);
	let draft = $state<Draft | null>(null);
	let importing = $state(false);
	let notice = $state<string | null>(null);
	let importSeq = 0;

	async function importLink(raw = link) {
		const value = raw.trim();
		if (!value) return;
		const seq = ++importSeq;
		let host = '';
		try {
			host = new URL(value.match(/https?:\/\/\S+/)?.[0] ?? `https://${value}`).hostname.replace(/^www\./, '');
		} catch {
			/* shown as plain fetch */
		}
		draft = { url: value, store: host, title: '' };
		notice = null;
		importing = true;
		editorOpen = true;
		try {
			const res = await fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: value }) });
			const r = (await res.json()) as ImportResult & { error?: string };
			if (seq !== importSeq) return;
			draft = {
				url: r.url ?? value,
				title: r.title ?? '',
				image_url: r.image_url,
				images: r.images ?? [],
				price_cents: r.price_cents,
				currency: r.currency,
				store: r.store,
				description: r.description,
				availability: r.availability,
				category_id: r.category_id,
				specifics: r.specifics ?? []
			};
			notice = r.error ?? (!r.ok ? 'Couldn’t read everything from that page. Fill in what’s missing.' : null);
		} catch {
			if (seq !== importSeq) return;
			draft = { url: value, title: '' };
			notice = 'Couldn’t reach the shop. Fill it in by hand and it’ll still save.';
		} finally {
			if (seq === importSeq) importing = false;
		}
		link = '';
	}

	function addManually() {
		importSeq++;
		importing = false;
		notice = null;
		draft = { title: '', currency: totals[0]?.[0] ?? 'USD' };
		editorOpen = true;
	}

	function edit(item: Item) {
		importSeq++;
		importing = false;
		notice = null;
		draft = { ...item, images: item.image_url ? [item.image_url] : [] };
		editorOpen = true;
	}

	/* ------------------------------------------------ quick actions */

	async function post(action: string, body: Record<string, string>) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(body)) fd.set(k, v);
		const res = await fetch(`?/${action}`, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		return deserialize(await res.text());
	}

	async function rate(item: Item, rating: number) {
		items = items.map((i) => (i.id === item.id ? { ...i, rating } : i));
		await post('rate', { id: item.id, rating: String(rating) });
	}

	async function saveOrder() {
		await post('reorder', { ids: items.map((i) => i.id).join(',') });
		await invalidateAll();
	}

	function move(item: Item, delta: -1 | 1) {
		const from = items.findIndex((i) => i.id === item.id);
		const to = from + delta;
		if (to < 0 || to >= items.length) return;
		const next = [...items];
		[next[from], next[to]] = [next[to], next[from]];
		items = next;
		saveOrder();
	}

	let dragId = $state<string | null>(null);
	function dragOver(e: DragEvent, over: Item) {
		if (!dragId || dragId === over.id) return;
		e.preventDefault();
		const from = items.findIndex((i) => i.id === dragId);
		const to = items.findIndex((i) => i.id === over.id);
		if (from < 0 || to < 0) return;
		const next = [...items];
		next.splice(to, 0, next.splice(from, 1)[0]);
		items = next;
	}
	function dragEnd() {
		if (!dragId) return;
		dragId = null;
		saveOrder();
	}

	/* ------------------------------------------------ list settings & sharing */

	let settingsOpen = $state(false);
	let shareOpen = $state(false);
	let confirmDeleteList = $state(false);
	let copied = $state(false);

	async function copyShare() {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}
</script>

<svelte:head><title>{data.list.name} · The Giver</title></svelte:head>

<a href="/" class="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-faint hover:text-fg">
	<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15l-5-5 5-5" /></svg>
	All lists
</a>

<!-- Header -->
<section class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div class="min-w-0">
		<p class="mb-2 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
			<span>{meta.icon} {meta.label}</span>
			{#if data.list.occasion_date}
				<span class="text-ink-500">•</span><span>{formatDate(data.list.occasion_date)}</span>
				<span class="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-semibold text-gold-300">{countdownLabel(data.list.occasion_date)}</span>
			{/if}
		</p>
		<h1 class="font-display text-3xl font-semibold tracking-tight break-words sm:text-4xl">{data.list.name}</h1>
		<p class="mt-2 text-sm text-fg-faint">
			{items.length}
			{items.length === 1 ? 'gift' : 'gifts'}{#each totals as [cur, cents] (cur)}<span>&nbsp;· {formatPrice(cents, cur)}</span>{/each}
		</p>
	</div>
	<div class="flex shrink-0 gap-2">
		<button class="btn-ghost" onclick={() => (shareOpen = true)}>
			<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13V3M6 7l4-4 4 4M4 11v5a1 1 0 001 1h10a1 1 0 001-1v-5" /></svg>
			{data.list.share_token ? 'Shared' : 'Share'}
		</button>
		<button class="btn-ghost px-3" aria-label="List settings" onclick={() => { confirmDeleteList = false; settingsOpen = true; }}>
			<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
		</button>
	</div>
</section>

<!-- Add a gift -->
<form
	class="card mb-8 flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
	onsubmit={(e) => {
		e.preventDefault();
		importLink();
	}}
>
	<div class="flex flex-1 items-center gap-3 px-3">
		<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="shrink-0 text-gold-400"><path d="M8.5 11.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1M11.5 8.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1" /></svg>
		<input
			class="w-full border-0 bg-transparent py-3 text-[15px] text-fg placeholder:text-fg-faint focus:ring-0 focus:outline-none"
			placeholder="Paste a link from Amazon or any shop…"
			bind:value={link}
			onpaste={(e) => {
				const text = e.clipboardData?.getData('text') ?? '';
				if (/https?:\/\//.test(text)) {
					e.preventDefault();
					importLink(text);
				}
			}}
		/>
	</div>
	<div class="flex gap-2">
		<button type="button" class="btn-quiet flex-1 sm:flex-none" onclick={addManually}>Add by hand</button>
		<button class="btn-primary flex-1 sm:flex-none" disabled={!link.trim()}>Add gift</button>
	</div>
</form>

{#if items.length === 0}
	<div class="rounded-3xl border border-dashed border-ink-600 px-6 py-20 text-center">
		<div class="mb-4 text-4xl">🛍️</div>
		<h2 class="font-display text-xl font-semibold">Nothing here yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Copy a product link from any shop and paste it above. The picture, name and price come in by themselves.</p>
	</div>
{:else}
	<!-- Toolbar -->
	<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
			<button class="chip shrink-0 {filter === 'all' ? 'chip-on' : 'hover:text-fg'}" onclick={() => (filter = 'all')}>All <span class="opacity-60">{items.length}</span></button>
			{#each usedCategories as c (c.id)}
				<button
					class="chip shrink-0 {filter === c.id ? 'chip-on' : 'hover:text-fg'}"
					style={filter === c.id ? `border-color: ${c.color}80; background: ${c.color}1f; color: ${c.color}` : ''}
					onclick={() => (filter = filter === c.id ? 'all' : c.id)}
				>
					{c.icon} {c.name} <span class="opacity-60">{c.count}</span>
				</button>
			{/each}
		</div>
		<div class="flex max-w-full shrink-0 items-center gap-1 self-start overflow-x-auto rounded-xl border border-ink-700/80 bg-ink-900/80 p-1">
			{#each SORTS as s (s.value)}
				<button
					class="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition {sort === s.value ? 'bg-ink-700 text-fg' : 'text-fg-faint hover:text-fg'}"
					onclick={() => (sort = s.value)}>{s.label}</button
				>
			{/each}
		</div>
	</div>

	{#if canReorder && items.length > 1}
		<p class="-mt-3 mb-5 hidden text-xs text-fg-faint sm:block">Drag cards to rank them, top-left is the one you want most.</p>
	{/if}

	<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
		{#each visible as item, i (item.id)}
			<div
				animate:flip={{ duration: 220 }}
				class="transition-opacity {dragId === item.id ? 'opacity-40' : ''}"
				draggable={canReorder}
				role="listitem"
				ondragstart={(e) => {
					dragId = item.id;
					e.dataTransfer?.setData('text/plain', item.id);
					if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
				}}
				ondragover={(e) => dragOver(e, item)}
				ondrop={(e) => e.preventDefault()}
				ondragend={dragEnd}
			>
				<ItemCard
					{item}
					category={item.category_id ? catById.get(item.category_id) : undefined}
					position={sort === 'rank' ? items.indexOf(item) + 1 : undefined}
					onopen={() => edit(item)}
					onrate={(r) => rate(item, r)}
					onmove={canReorder ? (d) => move(item, d) : undefined}
				/>
			</div>
		{/each}
	</div>
	{#if visible.length === 0}
		<p class="py-16 text-center text-sm text-fg-faint">No gifts in this category.</p>
	{/if}
{/if}

<ItemEditor bind:open={editorOpen} {draft} loading={importing} {notice} categories={data.categories} />

<!-- List settings -->
<Modal bind:open={settingsOpen} title="List settings">
	<form
		id="list-settings"
		method="POST"
		action="?/updateList"
		use:enhance={() => async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') settingsOpen = false;
		}}
	>
		<ListForm name={data.list.name} occasion={data.list.occasion} date={data.list.occasion_date ?? ''} description={data.list.description} showDescription />
	</form>
	<div class="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
		<form method="POST" action="?/deleteList" use:enhance class="flex items-center justify-between gap-4">
			<p class="text-sm text-fg-muted">Delete this list and every gift in it.</p>
			{#if confirmDeleteList}
				<button class="btn-danger shrink-0">Yes, delete</button>
			{:else}
				<button type="button" class="btn-quiet shrink-0 hover:text-red-300" onclick={() => (confirmDeleteList = true)}>Delete list</button>
			{/if}
		</form>
	</div>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (settingsOpen = false)}>Cancel</button>
			<button form="list-settings" class="btn-primary">Save</button>
		</div>
	{/snippet}
</Modal>

<!-- Sharing -->
<Modal bind:open={shareOpen} title="Share with givers">
	{#if shareUrl}
		<p class="mb-4 text-sm text-fg-muted">Anyone with this link can see the list and mark a gift as theirs, so nobody buys the same thing twice.</p>
		<div class="flex gap-2">
			<input class="field font-mono text-xs" readonly value={shareUrl} onfocus={(e) => e.currentTarget.select()} />
			<button class="btn-primary shrink-0" onclick={copyShare}>{copied ? 'Copied ✓' : 'Copy'}</button>
		</div>
		<div class="mt-6 flex items-center justify-between">
			<a href={shareUrl} target="_blank" rel="noopener" class="text-sm text-gold-300 hover:underline">See what givers see ↗</a>
			<form method="POST" action="?/unshare" use:enhance={() => async ({ update }) => { await update(); shareOpen = false; }}>
				<button class="btn-quiet hover:text-red-300">Stop sharing</button>
			</form>
		</div>
	{:else}
		<p class="mb-6 text-sm text-fg-muted">Create a private link to send to family and friends. They can mark gifts as theirs so nobody doubles up, and they don’t need an account.</p>
		<form method="POST" action="?/share" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<button class="btn-primary w-full">Create share link</button>
		</form>
	{/if}
</Modal>
