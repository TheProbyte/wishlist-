<script lang="ts" module>
	// Lists already opened this visit: their cards don't need to rise in again.
	const visited = new Set<string>();
</script>

<script lang="ts">
	import EmptyArt from '#lib/components/EmptyArt.svelte';
	import { onMount, tick } from 'svelte';
	import { enhance, deserialize } from '$app/forms';
	import { goto, invalidateAll, preloadData } from '$app/navigation';
	import { cardIn, cardOut, dur, pageSwipe, prefersReducedMotion } from '#lib/motion.ts';
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import ItemEditor, { type Draft } from '#lib/components/ItemEditor.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import GiftView from '#lib/components/GiftView.svelte';
	import PaperStrip from '#lib/components/PaperStrip.svelte';
	import PasteBar from '#lib/components/PasteBar.svelte';
	import SwipePages from '#lib/components/SwipePages.svelte';
	import { holdDrag } from '#lib/holdDrag.ts';
	import { contextMenu, type MenuSpec } from '#lib/menu.svelte.ts';
	import { untrack } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { firstTime, getPref, setPref } from '#lib/prefs.ts';
	import { countdownLabel, formatPrice, milestone, occasionDate, occasionMeta } from '#lib/format.ts';
	import type { ImportResult, Item } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Sort = 'rank' | 'rating' | 'price_asc' | 'price_desc' | 'newest';
	const SORTS: { value: Sort; label: string }[] = [
		{ value: 'rank', label: 'Most wanted' },
		{ value: 'rating', label: 'Most hearts' },
		{ value: 'price_asc', label: 'Price, low' },
		{ value: 'price_desc', label: 'Price, high' },
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
	const rankable = (pageId: string) => sort === 'rank' && pageId === 'all';
	// Dragging to rank (touch: press and hold; mouse: just drag) is holdDrag, on each card.

	/* ------------------------------------------------ cards coming and going */

	// The first time a list opens, its cards rise in. After that the list is simply there.
	const fresh = $derived(!visited.has(data.list.id));
	// Which list the cards on screen belong to. While a new list replaces the old one this lags
	// behind, so the swap itself doesn't fly cards about; after that, gifts added or removed animate.
	let settled = $state('');
	$effect(() => {
		const id = data.list.id;
		visited.add(id);
		settled = id;
	});
	const animateChanges = () => settled === data.list.id;

	/* ------------------------------------------------ view: photo grid or compact rows */

	let view = $state<'grid' | 'row'>('grid');
	// Remembered per list, on this device.
	$effect(() => {
		view = getPref(`view:${data.list.id}`) === 'row' ? 'row' : 'grid';
	});
	// Switching view morphs: each gift and its photo glide from the old layout to the new one
	// (where the browser can; elsewhere it simply switches).
	// Only the gifts on screen are named for the morph, straight on the elements (no re-render),
	// so the switch starts at once even on a long list.
	function toggleView() {
		const next = view === 'grid' ? 'row' : 'grid';
		const apply = () => {
			view = next;
			setPref(`view:${data.list.id}`, next);
		};
		if (!document.startViewTransition || prefersReducedMotion()) return apply();
		const named: HTMLElement[] = [];
		for (const el of document.querySelectorAll<HTMLElement>(`[data-page="${CSS.escape(filter)}"] [data-gift]`)) {
			const r = el.getBoundingClientRect();
			if (r.bottom < 0 || r.top > innerHeight) continue;
			el.style.viewTransitionName = `g-${el.dataset.gift}`;
			named.push(el);
			const photo = el.querySelector<HTMLElement>('[data-photo]');
			if (photo) {
				photo.style.viewTransitionName = `gp-${el.dataset.gift}`;
				named.push(photo);
			}
		}
		document.documentElement.dataset.nav = 'morph';
		const t = document.startViewTransition(async () => {
			apply();
			await tick();
		});
		t.finished.finally(() => named.forEach((el) => (el.style.viewTransitionName = '')));
	}

	/* ------------------------------------------------ swiping */

	// Categories are pages side by side in a native scroll-snap strip, so a swipe follows the finger
	// exactly: All, then each category in use.
	const pages = $derived(['all', ...usedCategories.map((c) => c.id)]);
	function followChip(id: string) {
		document.querySelector(`[data-chip="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: dur(1) ? 'smooth' : 'auto' });
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
	let plusOpen = $state(false);

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
			const r = (await res.json()) as ImportResult & { error?: string; kind?: string };
			if (seq !== importSeq) return;
			// A whole wish list (e.g. shared from the Amazon app): that's the import screen's job.
			if (r.kind === 'wishlist') {
				editorOpen = false;
				importing = false;
				link = '';
				return void goto(`/add?url=${encodeURIComponent(value)}`);
			}
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
		plusOpen = false;
		importSeq++;
		importing = false;
		notice = null;
		draft = { title: '', currency: totals[0]?.[0] ?? 'USD' };
		editorOpen = true;
	}

	/* ------------------------------------------------ looking at one gift */

	// Phones: a sheet. Wide screens: a panel beside the list, so the list stays in view.
	let viewingId = $state<string | null>(null);
	let viewSheet = $state(false);
	let wide = $state(false);
	$effect(() => {
		const mq = matchMedia('(min-width: 1024px)');
		const update = () => (wide = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});
	const viewing = $derived(viewingId ? items.find((i) => i.id === viewingId) : undefined);
	const panelOpen = $derived(wide && !!viewing);
	function openGift(item: Item) {
		viewingId = item.id;
		if (!wide) viewSheet = true;
	}
	function listNames(item: Item) {
		return item.lists.map((id) => data.lists.find((l) => l.id === id)?.name).filter((n): n is string => !!n);
	}
	function editViewing() {
		if (!viewing) return;
		viewSheet = false;
		edit(viewing);
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

	// The new order shows straight away; saving happens behind it.
	function saveOrder() {
		post('reorder', { ids: items.map((i) => i.id).join(',') });
	}

	function step(item: Item, delta: -1 | 1) {
		const from = items.findIndex((i) => i.id === item.id);
		const to = from + delta;
		if (to < 0 || to >= items.length) return;
		const next = [...items];
		[next[from], next[to]] = [next[to], next[from]];
		items = next;
		saveOrder();
	}

	function moveOnto(dragged: string, over: string) {
		const from = items.findIndex((i) => i.id === dragged);
		const to = items.findIndex((i) => i.id === over);
		if (from < 0 || to < 0 || from === to) return;
		const next = [...items];
		next.splice(to, 0, next.splice(from, 1)[0]);
		items = next;
	}


	/* ------------------------------------------------ menus */

	let sortOpen = $state(false);
	let moreOpen = $state(false);
	let settingsOpen = $state(false);
	let reordering = $state(false);
	const layout = $derived(reordering ? 'row' : view);

	function startReorder() {
		moreOpen = false;
		stopSelecting();
		sort = 'rank';
		filter = 'all';
		reordering = true;
	}

	// One-time tips, the first time they'd be useful on this device.
	let hint = $state<string | null>(null);
	onMount(() => {
		// Tips fade on their own after a while.
		setTimeout(() => (hint = null), 7000);
		if (!matchMedia('(pointer: coarse)').matches) {
			if (items.length > 2 && firstTime('drag-mouse')) hint = 'Drag a gift to move it up or down the list.';
			return;
		}
		if (items.length > 2 && firstTime('hold')) hint = 'Press and hold a gift to drag it up or down. Hold and let go to pick several.';
		else if (pages.length > 1 && firstTime('swipe')) hint = 'Swipe across your gifts to flip through categories.';
	});

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
	function startSelecting(first?: string) {
		moreOpen = false;
		reordering = false;
		selecting = true;
		selected = first ? [first] : [];
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
		// Act first: what's leaving this list leaves now, a new category shows now.
		const ids = new Set(selected);
		const leaves = op === 'delete' || op === 'remove' || (op === 'move' && !isEverything);
		const before = items;
		if (leaves) items = items.filter((i) => !ids.has(i.id));
		if (op === 'category') items = items.map((i) => (ids.has(i.id) ? { ...i, category_id: extra.category || null } : i));
		if (leaves || op === 'category') listSheet = categorySheet = deleteSheet = false;
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
			stopSelecting();
			setTimeout(() => (bulkNote = null), 2400);
			// The screen already shows the result; this just fetches the server's copy behind it.
			invalidateAll();
		} else {
			items = before;
			bulkNote = result.type === 'failure' ? String(result.data?.error ?? 'Couldn’t do that.') : 'Couldn’t do that. Try again.';
			setTimeout(() => (bulkNote = null), 3000);
		}
	}
	/* A gift's own menu: right-click it (with a finger, holding a gift drags it instead). */
	function giftMenu(item: Item): MenuSpec | null {
		if (selecting || reordering) return null;
		const first = items[0]?.id === item.id;
		return {
			title: item.title,
			sub: [formatPrice(item.price_cents, item.currency), item.store].filter(Boolean).join(' · ') || undefined,
			items: [
				{ label: 'Open', icon: 'gift', run: () => openGift(item) },
				{ label: 'Edit', icon: 'tag', run: () => edit(item) },
				...(item.url ? [{ label: item.store ?? 'Shop', icon: 'link', href: item.url, external: true }] : []),
				'divider' as const,
				...(first ? [] : [{ label: 'Move to the top', icon: 'chevron-up', run: () => moveToTop(item) }]),
				{ label: 'Select', icon: 'check-box', run: () => startSelecting(item.id) },
				...(isEverything ? [] : [{ label: 'Take off this list', icon: 'close', run: () => one('remove', item) }]),
				{ label: 'Delete gift', icon: 'close', danger: true, confirm: 'Click again to delete', run: () => one('delete', item) }
			]
		};
	}
	function moveToTop(item: Item) {
		items = [item, ...items.filter((i) => i.id !== item.id)];
		saveOrder();
	}
	async function one(op: string, item: Item) {
		selected = [item.id];
		await bulk(op);
		if (!selecting) selected = [];
	}

	// Arriving from a list's menu on the shelf: open its settings or sharing straight away.
	$effect(() => {
		const want = page.url.searchParams.get('open');
		if (!want) return;
		untrack(() => {
			if (want === 'settings') {
				confirmDeleteList = false;
				settingsOpen = true;
			} else if (want === 'share') shareOpen = true;
			const url = new URL(location.href);
			url.searchParams.delete('open');
			replaceState(url, page.state);
		});
	});

	// Picking gifts from the Everything list onto this occasion list.
	let pickOpen = $state(false);
	let picked = $state<string[]>([]);
	let shareOpen = $state(false);
	let confirmDeleteList = $state(false);
	let copied = $state(false);
	const canPick = $derived(!isEverything && data.pickable.length > 0);
	function openPick() {
		plusOpen = false;
		picked = [];
		pickOpen = true;
	}

	async function copyShare() {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}
</script>

<svelte:head><title>{title} · The Giver</title></svelte:head>
<svelte:window onclick={() => (sortOpen = false)} onkeydown={(e) => e.key === 'Escape' && (sortOpen = false)} />

<!-- Header: a short strip of this list's paper with the buttons on it, then the name and one line
     of facts. Swipe it to flip to the next list. -->
<section
	class="mb-4 sm:mb-6"
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
	<div class="relative -mt-3 sm:mt-0">
		<PaperStrip wrap={data.list.wrap} occasion={data.list.occasion} transitionName="paper-{data.list.id}" height="h-[60px] sm:h-20" />
		<a href="/" class="absolute top-2.5 left-2.5 grid h-10 w-10 place-items-center rounded-full bg-cocoa-950/85 text-fg shadow-[0_2px_0_0_var(--color-edge)] active:scale-95" aria-label="All lists">
			<Icon name="chevron-left" size={22} />
		</a>
		<div class="absolute top-2.5 right-2.5 flex gap-2">
			<button class="grid h-10 w-10 place-items-center rounded-full bg-cocoa-950/85 shadow-[0_2px_0_0_var(--color-edge)] active:scale-95 {data.list.share_token ? 'text-teal-300' : 'text-fg'}" aria-label={data.list.share_token ? 'Shared: see the link' : 'Share with givers'} onclick={() => (shareOpen = true)}>
				<Icon name="share" size={19} />
			</button>
			<button class="hidden h-10 w-10 place-items-center rounded-full bg-cocoa-950/85 text-fg shadow-[0_2px_0_0_var(--color-edge)] active:scale-95 sm:grid {items.length === 0 ? 'max-sm:grid' : ''}" aria-label="More" onclick={() => { confirmDeleteList = false; moreOpen = true; }}>
				<Icon name="more" size={20} />
			</button>
		</div>
	</div>
	<h1 class="display mt-3 text-[30px] leading-[1.08] break-words sm:text-[44px]">{title}</h1>
	<p class="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-fg-muted">
		{#if data.kid}<span class="rounded-full bg-teal-600 px-2 py-0.5 text-xs text-cream">{data.kid.name}</span>{/if}
		<Icon name={isEverything ? 'gift' : meta.icon} size={15} />
		<span>{items.length} {items.length === 1 ? 'gift' : 'gifts'}</span>
		{#each totals as [cur, cents] (cur)}<span class="text-cocoa-500">·</span><span class="text-mustard-400 tabular-nums">{formatPrice(cents, cur)}</span>{/each}
		{#if nextDate && !isEverything}<span class="text-cocoa-500">·</span><span class="text-rust-300">{countdownLabel(nextDate)}{#if turning}&nbsp;· {turning}{/if}</span>{/if}
	</p>
</section>

<!-- Add a gift: at the top of the list. (The bottom, in thumb reach, is for sorting and filtering.) -->
<PasteBar bind:value={link} onsubmit={importLink} onpastelink={importLink} onplus={() => (plusOpen = true)} class="mb-4 sm:mb-6" />

{#if items.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<EmptyArt class="mx-auto mb-3" />
		<h2 class="display text-2xl">Nothing wrapped yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Copy a product link from any shop and paste it in the bar. The picture, name and price come in by themselves.</p>
		<div class="mt-5 flex flex-wrap justify-center gap-2">
			<button class="btn-ghost text-sm" onclick={addManually}><Icon name="plus" size={16} />Add by hand</button>
			{#if canPick}<button class="btn-ghost text-sm" onclick={openPick}><Icon name="gift" size={16} />From Everything</button>{/if}
		</div>
	</div>
{:else}
	<!-- One toolbar: categories, sort, view and more. Phones: docked above the tab bar, in thumb
	     reach (it steps aside while selecting). Bigger screens: sticks under the header. -->
	<div
		class="lift-hide peel-follow fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-1.5 rounded-[var(--radius-card)] bg-cocoa-900 p-1.5 shadow-[0_3px_0_0_var(--color-edge),0_12px_32px_-8px_rgb(0_0_0/0.75)] ring-2 ring-cocoa-700 transition duration-200 sm:sticky sm:inset-x-auto sm:top-[var(--header-h)] sm:bottom-auto sm:mb-5 sm:gap-2 sm:rounded-none sm:bg-cocoa-950 sm:p-0 sm:py-2 sm:shadow-none sm:ring-0 {selecting || reordering ? 'max-sm:pointer-events-none max-sm:translate-y-[150%] max-sm:opacity-0' : ''}"
		style="view-transition-name: list-toolbar"
	>
		<div class="no-scrollbar -my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pr-4 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]" data-no-swipe>
			<button class="chip shrink-0 {filter === 'all' ? 'chip-on' : 'hover:text-fg'}" data-chip="all" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>All <span class="opacity-70">{items.length}</span></button>
			{#each usedCategories as c (c.id)}
				<button class="chip shrink-0 {filter === c.id ? 'chip-on' : 'hover:text-fg'}" data-chip={c.id} aria-pressed={filter === c.id} onclick={() => (filter = filter === c.id ? 'all' : c.id)}>
					<Icon name={c.icon} size={15} />{c.name} <span class="opacity-70">{c.count}</span>
				</button>
			{/each}
		</div>
		<div class="relative shrink-0">
			<button
				class="chip px-3 hover:text-fg {sort !== 'rank' ? 'text-mustard-400' : ''}"
				aria-haspopup="menu"
				aria-expanded={sortOpen}
				disabled={reordering}
				onclick={(e) => {
					e.stopPropagation();
					sortOpen = !sortOpen;
				}}
			>
				<Icon name="sort" size={15} /><span class="max-sm:sr-only">{SORTS.find((s) => s.value === sort)?.label}</span>
			</button>
			{#if sortOpen}
				<div role="menu" tabindex="-1" class="menu-in origin-bottom-right sm:origin-top-right absolute right-0 bottom-full z-40 mb-3 w-48 sm:top-full sm:bottom-auto sm:mt-2 sm:mb-0 rounded-[16px] bg-cocoa-850 p-1.5 shadow-[0_4px_0_0_var(--color-edge),0_16px_40px_-10px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
					{#each SORTS as s (s.value)}
						<button role="menuitemradio" aria-checked={sort === s.value} class="flex min-h-11 w-full items-center justify-between rounded-[10px] px-3 text-left text-sm font-bold {sort === s.value ? 'bg-cocoa-800 text-fg' : 'text-fg-muted hover:text-fg'}" onclick={() => { sort = s.value; sortOpen = false; }}>
							{s.label}{#if sort === s.value}<Icon name="check" size={16} class="text-mustard-400" />{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<button class="chip w-9 shrink-0 justify-center px-0 hover:text-fg" aria-label={view === 'grid' ? 'Show as a list' : 'Show as photos'} disabled={reordering} onclick={toggleView}>
			<Icon name={view === 'grid' ? 'rows' : 'grid'} size={17} />
		</button>
		<button class="chip w-9 shrink-0 justify-center px-0 hover:text-fg sm:hidden" aria-label="More" onclick={() => { confirmDeleteList = false; moreOpen = true; }}>
			<Icon name="more" size={18} />
		</button>
	</div>


	<div class={panelOpen ? 'grid grid-cols-[minmax(0,1fr)_380px] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : ''}>
	<div class="min-w-0">
	<SwipePages {pages} bind:active={filter} onchange={followChip}>
		{#snippet page(pageId)}
		<div class="@container">
		<div class={layout === 'row' ? 'grid grid-cols-1 gap-2 @xl:grid-cols-2 @xl:gap-3 @4xl:grid-cols-3 @6xl:grid-cols-4' : 'grid grid-cols-2 gap-2.5 @xl:gap-5 @[38rem]:grid-cols-3 @4xl:grid-cols-4 @5xl:grid-cols-5'} role="list">
			{#each giftsFor(pageId) as item, i (item.id)}
				<div
					animate:flip={{ duration: dur(200) }}
					in:cardIn={{ on: animateChanges() && !fresh }}
					out:cardOut={{ on: animateChanges() }}
					class="{i > 7 ? (layout === 'row' ? 'offscreen-row' : 'offscreen-card') : ''} {fresh ? 'rise' : ''} {panelOpen && viewingId === item.id ? 'viewing' : ''}"
					style="--i: {i}"
					role="listitem"
					data-gift={item.id}
					use:contextMenu={{ spec: () => giftMenu(item), touch: false }}
					use:holdDrag={{
						id: item.id,
						enabled: !selecting,
						draggable: rankable(pageId),
						onhold: (id) => (reordering ? undefined : startSelecting(id)),
						onover: moveOnto,
						ondrop: saveOrder
					}}
				>
					<ItemCard
						{item}
						{layout}
						position={sort === 'rank' ? items.indexOf(item) + 1 : undefined}
						onopen={() => (selecting ? toggleSelect(item.id) : reordering ? undefined : openGift(item))}
						icon={item.category_id ? (catById.get(item.category_id)?.icon ?? null) : null}
						onrate={selecting ? undefined : (r) => rate(item, r)}
						onstep={reordering && rankable(pageId) ? (d) => step(item, d) : undefined}
						selected={selecting ? isSelected(item.id) : null}
					/>
				</div>
			{/each}
		</div>
		</div>
		{/snippet}
	</SwipePages>
	</div>
	{#if panelOpen && viewing}
		<!-- Wide screens: the gift beside the list, staying in view as the list scrolls. -->
		<aside class="sticky top-[calc(var(--header-h)+64px)] max-h-[calc(100dvh-var(--header-h)-84px)] self-start overflow-y-auto rounded-[var(--radius-card)] bg-cocoa-900 p-4 shadow-[0_3px_0_0_var(--color-edge)] ring-2 ring-cocoa-800" aria-label="Gift">
			{#key viewing.id}
				<div class="rise">
					<GiftView
						item={viewing}
						category={viewing.category_id ? catById.get(viewing.category_id) : undefined}
						position={sort === 'rank' ? items.indexOf(viewing) + 1 : undefined}
						lists={listNames(viewing)}
						onedit={editViewing}
						onrate={(r) => rate(viewing!, r)}
						onclose={() => (viewingId = null)}
					/>
				</div>
			{/key}
		</aside>
	{/if}
	</div>
{/if}

{#if hint}
	<!-- A one-time tip, floating above the bottom bars so it doesn't push the gifts down. -->
	<div class="pointer-events-none fixed inset-x-0 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6" role="status">
		<p class="rise pointer-events-auto flex max-w-md items-start gap-2 rounded-[14px] bg-cocoa-800 px-3.5 py-2.5 text-[13px] text-fg shadow-[0_3px_0_0_var(--color-edge),0_12px_32px_-8px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700">
			<Icon name="sparkle" size={16} class="mt-px shrink-0 text-mustard-400" />
			<span class="flex-1">{hint}</span>
			<button class="-m-1 grid h-7 w-7 shrink-0 place-items-center text-fg-faint" aria-label="Got it" onclick={() => (hint = null)}><Icon name="close" size={15} /></button>
		</p>
	</div>
{/if}

<!-- Phones: one gift, as a sheet showing all of it. -->
<Modal bind:open={viewSheet}>
	{#snippet header()}<div class="h-2"></div>{/snippet}
	{#if viewing}
		<div class="-mt-2">
			<GiftView
				item={viewing}
				category={viewing.category_id ? catById.get(viewing.category_id) : undefined}
				position={sort === 'rank' ? items.indexOf(viewing) + 1 : undefined}
				lists={listNames(viewing)}
				onedit={editViewing}
				onrate={(r) => rate(viewing!, r)}
			/>
		</div>
	{/if}
</Modal>

<!-- More: everything that used to crowd the header. -->
<Modal bind:open={moreOpen} title={title}>
	<div class="space-y-2">
		{#if items.length}
			<button class="card flex w-full items-center gap-3 p-3.5 text-left" onclick={() => startSelecting()}>
				<span class="grid h-10 w-10 place-items-center rounded-full bg-cocoa-800 text-mustard-400"><Icon name="check-box" size={20} /></span>
				<span><span class="block font-bold">Select gifts</span><span class="text-sm text-fg-muted">Move, delete or sort several at once.</span></span>
			</button>
		{/if}
		{#if items.length > 1}
			<button class="card flex w-full items-center gap-3 p-3.5 text-left" onclick={startReorder}>
				<span class="grid h-10 w-10 place-items-center rounded-full bg-cocoa-800 text-mustard-400"><Icon name="grip" size={20} /></span>
				<span><span class="block font-bold">Reorder</span><span class="text-sm text-fg-muted">Put the ones you want most at the top.</span></span>
			</button>
		{/if}
		<button class="card flex w-full items-center gap-3 p-3.5 text-left" onclick={() => { moreOpen = false; confirmDeleteList = false; settingsOpen = true; }}>
			<span class="grid h-10 w-10 place-items-center rounded-full bg-cocoa-800 text-mustard-400"><Icon name={isEverything ? 'gift' : meta.icon} size={20} /></span>
			<span><span class="block font-bold">{isEverything ? 'Wish list settings' : 'List settings'}</span><span class="text-sm text-fg-muted">{isEverything ? 'Name and wrapping paper.' : 'Name, date and wrapping paper.'}</span></span>
		</button>
	</div>
	{#if !isEverything}
		<form method="POST" action="?/deleteList" use:enhance class="mt-6 flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-rust-500/10 p-3.5 pl-4">
			<p class="text-sm text-fg-muted">{confirmDeleteList ? `Delete ${data.list.name}? Its gifts stay in Everything.` : 'Done with this list?'}</p>
			{#if confirmDeleteList}
				<div class="flex shrink-0 gap-1.5">
					<button type="button" class="btn-quiet px-3 text-sm" onclick={() => (confirmDeleteList = false)}>Keep</button>
					<button class="btn-danger px-3 text-sm">Delete</button>
				</div>
			{:else}
				<button type="button" class="btn-quiet shrink-0 px-3 text-sm text-rust-300 hover:text-rust-300" onclick={() => (confirmDeleteList = true)}>Delete list</button>
			{/if}
		</form>
	{/if}
</Modal>

<!-- + in the paste bar: the other ways to add. -->
<Modal bind:open={plusOpen} title="Add a gift">
	<div class="space-y-2">
		<button class="card flex w-full items-center gap-3 p-4 text-left" onclick={addManually}>
			<span class="grid h-11 w-11 place-items-center rounded-full bg-mustard-400 text-cocoa-950"><Icon name="plus" size={22} /></span>
			<span><span class="block font-bold">Add by hand</span><span class="text-sm text-fg-muted">Anything, no link needed. Add your own photo.</span></span>
		</button>
		{#if canPick}
			<button class="card flex w-full items-center gap-3 p-4 text-left" onclick={openPick}>
				<span class="grid h-11 w-11 place-items-center rounded-full bg-teal-600 text-cream"><Icon name="gift" size={20} /></span>
				<span><span class="block font-bold">From Everything</span><span class="text-sm text-fg-muted">Pick gifts already on your wish list.</span></span>
			</button>
		{/if}
	</div>
</Modal>

<!-- Reorder mode: arrows on every gift, and a bar to finish. -->
{#if reordering}
	<div class="peel-follow fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-5" transition:fly={{ y: 90, duration: dur(220), opacity: 1 }}>
		<div class="mx-auto flex max-w-3xl items-center gap-3 rounded-[var(--radius-card)] bg-cocoa-900 p-2 pl-4 shadow-[0_4px_0_0_var(--color-edge),0_16px_40px_-10px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700">
			<span class="flex-1 text-sm text-fg-muted">Use the arrows, or hold a gift and drag it.</span>
			<button class="btn-primary min-h-10 px-4 text-sm" onclick={() => (reordering = false)}>Done</button>
		</div>
	</div>
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
	ongone={(id) => (items = items.filter((i) => i.id !== id))}
	onfail={(m) => {
		bulkNote = m;
		setTimeout(() => (bulkNote = null), 3000);
	}}
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
		<ListForm name={data.list.name} occasion={data.list.occasion} date={data.list.occasion_date ?? ''} wrap={data.list.wrap} description={data.list.description} showDescription everything={isEverything} knownBirthday={data.birthday} knownWho={data.kid ? `${data.kid.name}’s` : 'your'} />
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
					<ProductImage src={g.image_url} alt="" size={160} seed={g.id} class="aspect-square w-full rounded-[10px]" />
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
	<div class="peel-follow fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-5" style="view-transition-name: bulk-bar" transition:fly={{ y: 90, duration: dur(220), opacity: 1 }}>
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
	<div class="fixed inset-x-0 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 sm:bottom-6" role="status">
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
