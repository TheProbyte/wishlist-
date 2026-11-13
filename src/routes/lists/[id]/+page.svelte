<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { goto, invalidateAll, preloadData } from '$app/navigation';
	import { dur, pageSwipe, setNavDirection } from '#lib/motion.ts';
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import ItemEditor, { type Draft } from '#lib/components/ItemEditor.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import PaperStrip from '#lib/components/PaperStrip.svelte';
	import SwipePages from '#lib/components/SwipePages.svelte';
	import { countdownLabel, formatDate, formatPrice, milestone, occasionDate, occasionMeta } from '#lib/format.ts';
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
	/** The gifts on one category page, in the chosen sort. */
	function giftsFor(pageId: string): Item[] {
		let list = pageId === 'all' ? items : items.filter((i) => i.category_id === pageId);
		const byPrice = (i: Item) => i.price_cents ?? (sort === 'price_asc' ? Infinity : -Infinity);
		if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating || a.rank - b.rank);
		if (sort === 'price_asc') list = [...list].sort((a, b) => byPrice(a) - byPrice(b));
		if (sort === 'price_desc') list = [...list].sort((a, b) => byPrice(b) - byPrice(a));
		if (sort === 'newest') list = [...list].sort((a, b) => b.created_at - a.created_at);
		return list;
	}
	const canReorder = $derived(sort === 'rank' && filter === 'all');
	const rankable = (pageId: string) => sort === 'rank' && pageId === 'all';
	// Drag-to-rank is for mice. On touch screens dragging would swallow swipes, and the arrows do the job.
	let finePointer = $state(false);
	$effect(() => {
		finePointer = matchMedia('(pointer: fine)').matches;
	});

	/* ------------------------------------------------ swiping */

	// Categories are pages side by side in a native scroll-snap strip, so a swipe follows the finger
	// exactly: All, then each category in use.
	const pages = $derived(['all', ...usedCategories.map((c) => c.id)]);
	function showCategory(id: string) {
		filter = id;
	}
	function followChip(id: string) {
		document.querySelector(`[data-chip="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: dur(1) ? 'smooth' : 'auto' });
	}

	// Swipe the header (or use the arrows) to flip to the next or previous list.
	function toList(id: string | null, direction: 'next' | 'prev') {
		if (!id) return;
		setNavDirection(direction);
		return goto(`/lists/${id}`);
	}
	function liveToList(id: string | null) {
		if (!id) return;
		return goto(`/lists/${id}`);
	}

	const totals = $derived.by(() => {
		const by = new Map<string, number>();
		for (const i of items) if (i.price_cents != null) by.set(i.currency ?? 'USD', (by.get(i.currency ?? 'USD') ?? 0) + i.price_cents * i.quantity);
		return [...by.entries()].sort((a, b) => b[1] - a[1]);
	});

	const meta = $derived(occasionMeta(data.list.occasion));
	const isEverything = $derived(data.list.kind === 'master');
	// What to call this list in headings: the Everything list is named after its person.
	const title = $derived(isEverything ? (data.kid ? `${data.kid.name}’s wish list` : 'Everything') : data.list.name);
	const nextDate = $derived(occasionDate(data.list.occasion, data.list.occasion_date));
	const turning = $derived(milestone(data.list.occasion, data.list.occasion_date));
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

	/* ------------------------------------------------ select several */

	let selecting = $state(false);
	let selected = $state<string[]>([]);
	let listSheet = $state(false);
	let categorySheet = $state(false);
	let deleteSheet = $state(false);
	let bulkBusy = $state(false);
	let bulkNote = $state<string | null>(null);
	const isSelected = (id: string) => selected.includes(id);
	function toggleSelect(id: string) {
		selected = isSelected(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}
	function stopSelecting() {
		selecting = false;
		selected = [];
		listSheet = categorySheet = deleteSheet = false;
	}
	const onThisPage = $derived(giftsFor(filter).map((i) => i.id));
	const allOnPageSelected = $derived(onThisPage.length > 0 && onThisPage.every((id) => selected.includes(id)));

	async function bulk(op: string, extra: Record<string, string> = {}) {
		bulkBusy = true;
		const fd = new FormData();
		fd.set('op', op);
		for (const id of selected) fd.append('ids', id);
		for (const [k, v] of Object.entries(extra)) fd.set(k, v);
		const res = await fetch('?/bulk', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		bulkBusy = false;
		if (result.type === 'success') {
			const n = selected.length;
			const target = data.lists.find((l) => l.id === extra.target)?.name;
			bulkNote =
				op === 'delete' ? `Deleted ${n}` : op === 'remove' ? `Removed ${n} from this list` : op === 'category' ? `Updated ${n}` : `${op === 'move' ? 'Moved' : 'Added'} ${n} to ${target}`;
			const note = bulkNote;
			bulkNote = null;
			stopSelecting();
			// Show the confirmation once the list on screen has caught up.
			await invalidateAll();
			bulkNote = note;
			setTimeout(() => (bulkNote = null), 2400);
		} else if (result.type === 'failure') {
			bulkNote = String(result.data?.error ?? 'Couldn’t do that.');
		}
	}
	// Picking gifts from the Everything list onto this occasion list.
	let pickOpen = $state(false);
	let picked = $state<string[]>([]);
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

<svelte:head><title>{title} · The Giver</title></svelte:head>

<div class="-mt-2 mb-3 flex items-center justify-between">
	<a href="/" class="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg">
		<Icon name="chevron-left" size={18} />
		All lists
	</a>
	{#if data.neighbours.prev || data.neighbours.next}
		<div class="flex gap-1">
			<button class="btn-quiet w-11 px-0" aria-label="Previous list" disabled={!data.neighbours.prev} onclick={() => toList(data.neighbours.prev, 'prev')}><Icon name="chevron-left" size={20} /></button>
			<button class="btn-quiet w-11 px-0" aria-label="Next list" disabled={!data.neighbours.next} onclick={() => toList(data.neighbours.next, 'next')}><Icon name="chevron-right" size={20} /></button>
		</div>
	{/if}
</div>

<!-- Header: a strip of this list's wrapping paper, then the title on plain cocoa. Swipe it to change list. -->
<section
	class="mb-6"
	use:pageSwipe={{
		canLeft: !!data.neighbours.next,
		canRight: !!data.neighbours.prev,
		left: () => liveToList(data.neighbours.next),
		right: () => liveToList(data.neighbours.prev),
		preload: (d) => {
			const id = d === 'left' ? data.neighbours.next : data.neighbours.prev;
			if (id) preloadData(`/lists/${id}`);
		},
		target: () => document.querySelector('main')
	}}
>
	<PaperStrip wrap={data.list.wrap} occasion={data.list.occasion} transitionName="paper-{data.list.id}" />
	<div class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div class="min-w-0">
			<p class="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-fg-muted">
				{#if data.kid}<span class="rounded-full bg-teal-600 px-2.5 py-0.5 text-xs text-cream">{data.kid.name}</span>{/if}
				{#if isEverything}
					<span class="inline-flex items-center gap-1.5"><Icon name="gift" size={16} />Every gift{data.kid ? ` ${data.kid.name} would love` : ' you’d love'}, in one list</span>
				{:else}
					<span class="inline-flex items-center gap-1.5"><Icon name={meta.icon} size={16} />{meta.label}</span>
				{/if}
				{#if nextDate && !isEverything}
					<span class="text-cocoa-500">·</span><span>{formatDate(nextDate)}</span>
					<span class="text-rust-300">{countdownLabel(nextDate)}{#if turning}&nbsp;· {turning}{/if}</span>
				{/if}
			</p>
			<h1 class="display text-[34px] leading-[1.08] break-words sm:text-[44px]">{title}</h1>
			<div class="mt-3 flex flex-wrap gap-2">
				<GiftTag>{items.length} {items.length === 1 ? 'gift' : 'gifts'}</GiftTag>
				{#each totals as [cur, cents] (cur)}<GiftTag tone="mustard">{formatPrice(cents, cur)}</GiftTag>{/each}
			</div>
		</div>
		<div class="flex shrink-0 gap-2">
			<button class="btn-teal" onclick={() => (shareOpen = true)}>
				<Icon name={data.list.share_token ? 'check' : 'share'} size={18} />
				{data.list.share_token ? 'Shared' : 'Share'}
			</button>
			<button class="btn-ghost w-11 px-0" aria-label="List settings" onclick={() => { confirmDeleteList = false; settingsOpen = true; }}>
				<Icon name="more" size={20} />
			</button>
		</div>
	</div>
</section>

<!-- Add a gift -->
<form
	class="mb-8 flex flex-col gap-2 rounded-[var(--radius-card)] bg-cocoa-850 p-2 ring-2 ring-cocoa-700 focus-within:ring-mustard-400 sm:flex-row sm:items-center"
	onsubmit={(e) => {
		e.preventDefault();
		importLink();
	}}
>
	<label class="flex flex-1 items-center gap-3 px-3">
		<Icon name="link" size={20} class="text-mustard-400" />
		<span class="sr-only">Product link</span>
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
	</label>
	<div class="flex gap-2">
		{#if !isEverything && data.pickable.length}
			<button type="button" class="btn-quiet flex-1 sm:flex-none" onclick={() => { picked = []; pickOpen = true; }}>From Everything</button>
		{/if}
		<button type="button" class="btn-quiet flex-1 sm:flex-none" onclick={addManually}>Add by hand</button>
		<button class="btn-primary flex-1 sm:flex-none" disabled={!link.trim()}>Add gift</button>
	</div>
</form>

{#if items.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-16 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-850 text-mustard-400"><Icon name="gift" size={30} /></div>
		<h2 class="display text-2xl">Nothing wrapped yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Copy a product link from any shop and paste it above. The picture, name and price come in by themselves.</p>
	</div>
{:else}
	<!-- Toolbar -->
	<div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" data-no-swipe>
			<button class="chip shrink-0 {filter === 'all' ? 'chip-on' : 'hover:text-fg'}" data-chip="all" aria-pressed={filter === 'all'} onclick={() => showCategory('all')}>All <span class="opacity-70">{items.length}</span></button>
			{#each usedCategories as c (c.id)}
				<button class="chip shrink-0 {filter === c.id ? 'chip-on' : 'hover:text-fg'}" data-chip={c.id} aria-pressed={filter === c.id} onclick={() => showCategory(filter === c.id ? 'all' : c.id)}>
					<Icon name={c.icon} size={15} />{c.name} <span class="opacity-70">{c.count}</span>
				</button>
			{/each}
		</div>
		<div class="flex max-w-full min-w-0 items-center gap-2 self-stretch lg:self-auto">
		<button class="btn-ghost min-h-11 shrink-0 px-3 text-sm {selecting ? 'bg-mustard-400 text-cocoa-950 hover:bg-mustard-300' : ''}" aria-pressed={selecting} onclick={() => (selecting ? stopSelecting() : (selecting = true))}>
			<Icon name="check" size={16} />{selecting ? 'Done' : 'Select'}
		</button>
		<div class="flex min-w-0 items-center gap-1 overflow-x-auto rounded-[var(--radius-control)] bg-sunken p-1" data-no-swipe>
			{#each SORTS as s (s.value)}
				<button
					class="min-h-9 rounded-[10px] px-3 text-[13px] font-bold whitespace-nowrap transition {sort === s.value ? 'bg-cocoa-700 text-fg' : 'text-fg-faint hover:text-fg'}"
					aria-pressed={sort === s.value}
					onclick={() => (sort = s.value)}>{s.label}</button
				>
			{/each}
		</div>
		</div>
	</div>

	{#if canReorder && items.length > 1}
		<p class="-mt-3 mb-5 hidden text-xs text-fg-faint sm:block">Drag cards to rank them. Top-left is the one you want most.</p>
	{/if}
	{#if pages.length > 1}
		<p class="-mt-3 mb-4 text-xs text-fg-faint sm:hidden">Swipe across your gifts to flip through categories.</p>
	{/if}

	<SwipePages {pages} bind:active={filter} onchange={followChip}>
	{#snippet page(pageId)}
	<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
		{#each giftsFor(pageId) as item, i (item.id)}
			<div
				animate:flip={{ duration: dur(220) }}
				class="rise transition-opacity {dragId === item.id ? 'opacity-40' : ''}"
				style="--i: {i}"
				draggable={rankable(pageId) && finePointer && !selecting}
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
					onopen={() => (selecting ? toggleSelect(item.id) : edit(item))}
					onrate={selecting ? undefined : (r) => rate(item, r)}
					onmove={rankable(pageId) && !selecting ? (d) => move(item, d) : undefined}
					selected={selecting ? isSelected(item.id) : null}
				/>
			</div>
		{/each}
	</div>
	{/snippet}
	</SwipePages>
{/if}

<ItemEditor
	bind:open={editorOpen}
	{draft}
	loading={importing}
	{notice}
	categories={data.categories}
	lists={data.lists}
	currentList={isEverything ? null : data.list.id}
	sizes={data.sizes}
	saveLabel={isEverything ? 'Add gift' : 'Add to list'}
/>

<!-- List settings -->
<Modal bind:open={settingsOpen} title={isEverything ? 'Wish list settings' : 'List settings'}>
	<form
		id="list-settings"
		method="POST"
		action="?/updateList"
		use:enhance={() => async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') settingsOpen = false;
		}}
	>
		<ListForm name={data.list.name} occasion={data.list.occasion} date={data.list.occasion_date ?? ''} wrap={data.list.wrap} description={data.list.description} showDescription everything={isEverything} />
	</form>
	{#if !isEverything}
	<div class="mt-8 rounded-[var(--radius-card)] bg-rust-500/10 p-4">
		<form method="POST" action="?/deleteList" use:enhance class="flex items-center justify-between gap-4">
			<p class="text-sm text-fg-muted">Delete this list. Its gifts stay in your Everything list.</p>
			{#if confirmDeleteList}
				<button class="btn-danger shrink-0">Yes, delete</button>
			{:else}
				<button type="button" class="btn-quiet shrink-0 text-rust-300 hover:text-rust-300" onclick={() => (confirmDeleteList = true)}>Delete list</button>
			{/if}
		</form>
	</div>
	{/if}
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
			<button class="btn-teal shrink-0" onclick={copyShare}>{copied ? 'Copied' : 'Copy'}</button>
		</div>
		<div class="mt-6 flex items-center justify-between">
			<a href={shareUrl} target="_blank" rel="noopener" class="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal-300 hover:underline">See what givers see <Icon name="external" size={15} /></a>
			<form method="POST" action="?/unshare" use:enhance={() => async ({ update }) => { await update(); shareOpen = false; }}>
				<button class="btn-quiet hover:text-rust-300">Stop sharing</button>
			</form>
		</div>
	{:else}
		<p class="mb-6 text-sm text-fg-muted">Create a private link to send to family and friends. They can mark gifts as theirs so nobody doubles up, and they don’t need an account.</p>
		<form method="POST" action="?/share" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<button class="btn-teal w-full">Create share link</button>
		</form>
	{/if}
</Modal>

<Modal bind:open={pickOpen} title="Add from your wish list">
	<form
		id="pick-form"
		method="POST"
		action="?/addExisting"
		use:enhance={() => async ({ update, result }) => {
			await update();
			if (result.type === 'success') pickOpen = false;
		}}
	>
		<p class="mb-4 text-sm text-fg-muted">Tap the gifts that belong on {data.list.name}. They stay in Everything too.</p>
		<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
			{#each data.pickable as g (g.id)}
				{@const on = picked.includes(g.id)}
				<label class="relative cursor-pointer overflow-hidden rounded-[14px] bg-cocoa-850 p-1.5 ring-3 transition {on ? 'ring-mustard-400' : 'ring-transparent'}">
					<input type="checkbox" name="ids" value={g.id} class="sr-only" checked={on} onchange={() => (picked = on ? picked.filter((x) => x !== g.id) : [...picked, g.id])} />
					<ProductImage src={g.image_url} alt="" class="aspect-square w-full rounded-[10px]" />
					<span class="mt-1.5 line-clamp-2 block px-1 text-xs font-bold">{g.title}</span>
					{#if g.price_cents != null}<span class="block px-1 pb-1 text-xs text-fg-muted">{formatPrice(g.price_cents, g.currency)}</span>{/if}
					{#if on}<span class="absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-mustard-400 text-cocoa-950"><Icon name="check" size={16} /></span>{/if}
				</label>
			{/each}
		</div>
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (pickOpen = false)}>Cancel</button>
			<button form="pick-form" class="btn-primary" disabled={!picked.length}>Add {picked.length || ''} {picked.length === 1 ? 'gift' : 'gifts'}</button>
		</div>
	{/snippet}
</Modal>

<!-- Select several: the action bar sits above the tab bar while selecting. -->
{#if selecting}
	<div class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-5" style="view-transition-name: bulk-bar">
		<div class="mx-auto flex max-w-3xl items-center gap-1.5 rounded-[var(--radius-card)] bg-cocoa-900 p-2 shadow-[0_4px_0_0_var(--color-edge),0_16px_40px_-10px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700">
			<span class="pl-2 text-sm font-bold whitespace-nowrap">{selected.length}<span class="hidden min-[400px]:inline"> picked</span></span>
			<button class="btn-quiet min-h-10 px-2 text-sm" onclick={() => (selected = allOnPageSelected ? selected.filter((id) => !onThisPage.includes(id)) : [...new Set([...selected, ...onThisPage])])}>
				{allOnPageSelected ? 'None' : 'All'}
			</button>
			<span class="flex-1"></span>
			{#if data.lists.length}
				<button class="btn-ghost min-h-10 px-2.5 text-sm" disabled={!selected.length || bulkBusy} onclick={() => (listSheet = true)}><Icon name="plus" size={16} />List</button>
			{/if}
			<button class="btn-ghost min-h-10 px-2.5 text-sm" aria-label="Set category" disabled={!selected.length || bulkBusy} onclick={() => (categorySheet = true)}><Icon name="tag" size={16} /><span class="hidden min-[420px]:inline">Category</span></button>
			{#if !isEverything}
				<button class="btn-ghost min-h-10 px-2.5 text-sm" disabled={!selected.length || bulkBusy} onclick={() => bulk('remove')}>Remove</button>
			{/if}
			<button class="btn-danger min-h-10 px-2.5 text-sm" disabled={!selected.length || bulkBusy} onclick={() => (deleteSheet = true)}>Delete</button>
		</div>
	</div>
{/if}
{#if bulkNote}
	<div class="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 sm:bottom-6" role="status">
		<span class="stamp rounded-full bg-cream px-4 py-2 text-sm font-bold text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)]">{bulkNote}</span>
	</div>
{/if}

<Modal bind:open={listSheet} title="Put {selected.length} on a list">
	<p class="mb-4 text-sm text-fg-muted">They stay in Everything{isEverything ? '' : ' too'}.</p>
	<div class="space-y-2">
		{#each data.lists.filter((l) => l.id !== data.list.id) as l (l.id)}
			<div class="flex items-center gap-2 rounded-[var(--radius-control)] bg-cocoa-850 p-2 pl-3.5">
				<Icon name={occasionMeta(l.occasion).icon} size={18} />
				<span class="flex-1 font-bold">{l.name}</span>
				<button class="btn-ghost min-h-10 px-3 text-sm" disabled={bulkBusy} onclick={() => bulk('add', { target: l.id })}>Add</button>
				{#if !isEverything}<button class="btn-primary min-h-10 px-3 text-sm" disabled={bulkBusy} onclick={() => bulk('move', { target: l.id })}>Move</button>{/if}
			</div>
		{/each}
	</div>
	{#if !isEverything}<p class="mt-4 text-xs text-fg-faint">Add keeps them here as well. Move takes them off {data.list.name}.</p>{/if}
	{#snippet footer()}
		<div class="flex justify-end"><button class="btn-quiet" onclick={() => (listSheet = categorySheet = false)}>Cancel</button></div>
	{/snippet}
</Modal>

<Modal bind:open={categorySheet} title="Set a category for {selected.length}">
	<div class="flex flex-wrap gap-2">
		{#each data.categories as c (c.id)}
			<button class="chip min-h-11 hover:text-fg" disabled={bulkBusy} onclick={() => bulk('category', { category: c.id })}><Icon name={c.icon} size={16} />{c.name}</button>
		{/each}
		<button class="chip min-h-11 hover:text-fg" disabled={bulkBusy} onclick={() => bulk('category', { category: '' })}>No category</button>
	</div>
	{#snippet footer()}
		<div class="flex justify-end"><button class="btn-quiet" onclick={() => (listSheet = categorySheet = false)}>Cancel</button></div>
	{/snippet}
</Modal>

<Modal bind:open={deleteSheet} title="Delete {selected.length} {selected.length === 1 ? 'gift' : 'gifts'}?">
	<p class="text-sm text-fg-muted">They’ll be gone from Everything and every list they’re on.{#if !isEverything} To just take them off {data.list.name}, use Remove instead.{/if}</p>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button class="btn-quiet" onclick={() => (deleteSheet = false)}>Keep them</button>
			<button class="btn-danger" disabled={bulkBusy} onclick={() => bulk('delete')}>{bulkBusy ? 'Deleting…' : 'Delete'}</button>
		</div>
	{/snippet}
</Modal>
