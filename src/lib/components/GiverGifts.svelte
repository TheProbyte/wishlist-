<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly, scale } from 'svelte/transition';
	import { dur } from '#lib/motion.ts';
	import { toast } from '#lib/undo.svelte.ts';
	import ProductImage from './ProductImage.svelte';
	import Stars from './Stars.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import Sticker from './Sticker.svelte';
	import Confetti from './Confetti.svelte';
	import Rosette from './Rosette.svelte';
	import { progressive } from '#lib/progressive.svelte.ts';
	import { formatPrice, hasPriceDrop } from '#lib/format.ts';
	import { paperFor } from '#lib/papers.ts';
	import type { Category, GiverItem } from '#lib/types.ts';


	/** The giver's view of gifts: claim one, see what's taken, undo. Used by both kinds of share link. */
	let {
		items,
		categories,
		giverName,
		error = null,
		preview = false,
		lane = []
	}: {
		items: GiverItem[];
		categories: Category[];
		giverName: string;
		error?: string | null;
		preview?: boolean;
		/** The most wanted few, shown big in a row above the rest. */
		lane?: GiverItem[];
	} = $props();

	/* Taken: someone's getting it, or the chip-ins cover the price. Yours (either way) isn't "taken". */
	const SPLIT_FROM = 6000;
	const covered = (i: GiverItem) => i.price_cents != null && i.chipped > 0 && i.chipped >= i.price_cents;
	const isTaken = (i: GiverItem) => (i.claimed >= i.quantity || covered(i)) && i.mine === 0 && i.myChip === 0;
	const splittable = (i: GiverItem) => i.price_cents != null && i.price_cents >= SPLIT_FROM && i.quantity === 1 && i.claimed === 0;
	const left = (i: GiverItem) => Math.max(0, (i.price_cents ?? 0) - i.chipped);

	// Chipping in: how much, with quick picks that split what's left.
	let chipId = $state<string | null>(null);
	let chipOpen = $state(false);
	let amount = $state('');
	const chipItem = $derived(items.find((i) => i.id === chipId) ?? lane.find((i) => i.id === chipId));
	function chipIn(id: string) {
		chipId = id;
		const it = items.find((i) => i.id === id) ?? lane.find((i) => i.id === id);
		amount = it ? ((Math.ceil(left(it) / 2 / 100) * 100) / 100).toFixed(0) : '';
		chipOpen = true;
	}
	const picks = $derived.by(() => {
		if (!chipItem) return [];
		const rest = left(chipItem);
		const out = [2, 3, 4].map((n) => ({ label: n === 2 ? 'Half' : n === 3 ? 'A third' : 'A quarter', cents: Math.ceil(rest / n / 100) * 100 }));
		return [...out, { label: 'All the rest', cents: rest }].filter((p, k, a) => p.cents >= 100 && a.findIndex((q) => q.cents === p.cents) === k);
	});

	// Your own note on a gift you're getting: only you see it.
	let noteDraft = $state('');
	let noteSaved = $state(false);

	let claimingId = $state<string | null>(null);
	let nameOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let name = $state(giverName);
	// The gift just claimed, and a counter that launches its confetti.
	let celebrating = $state<string | null>(null);
	let fire = $state(0);

	// The server builds the first cards; the rest are added as soon as the page is up.
	const built = progressive();
	// Yours first, then what's still free to pick, then the taken ones (folded away).
	const isMine = (i: GiverItem) => !preview && (i.mine > 0 || i.myChip > 0);
	const mine = $derived(items.filter(isMine));
	const open = $derived(built.cap(items.filter((i) => !isMine(i) && !isTaken(i))));
	const taken = $derived(items.filter((i) => !isMine(i) && isTaken(i)));
	let showTaken = $state(false);
	const claimingItem = $derived(items.find((i) => i.id === claimingId) ?? lane.find((i) => i.id === claimingId));
	const catIcon = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.icon ?? null) : null);

	// Tap a gift for everything about it: big photo, their note, sizes, the shop, and claiming.
	let detailId = $state<string | null>(null);
	let detailOpen = $state(false);
	const detail = $derived(items.find((i) => i.id === detailId) ?? lane.find((i) => i.id === detailId));
	function openDetail(id: string) {
		detailId = id;
		noteDraft = (items.find((i) => i.id === id) ?? lane.find((i) => i.id === id))?.myNote ?? '';
		noteSaved = false;
		detailOpen = true;
	}
	/* Back from the shop: people buy (or mark it bought on Amazon) and forget to say so here, so
	   nobody else knows. Tapping a shop link remembers which gift it was; coming back to this
	   page (even after the browser reloaded it), a strip asks if they got it, with the button. */
	const SHOP_KEY = 'giver:shop';
	function wentToShop(item: GiverItem) {
		if (preview || item.mine > 0 || item.myChip > 0 || isTaken(item)) return;
		try {
			sessionStorage.setItem(SHOP_KEY, JSON.stringify({ id: item.id, title: item.title, at: Date.now() }));
		} catch {
			/* private mode: no reminder, that's all */
		}
	}
	function backFromShop() {
		if (document.visibilityState !== 'visible') return;
		let seen: { id: string; title: string; at: number } | null = null;
		try {
			seen = JSON.parse(sessionStorage.getItem(SHOP_KEY) ?? 'null');
		} catch {
			seen = null;
		}
		if (!seen) return;
		const away = Date.now() - seen.at;
		if (away < 2500) return; // just switching apps for a second
		sessionStorage.removeItem(SHOP_KEY);
		const item = items.find((i) => i.id === seen!.id) ?? lane.find((i) => i.id === seen!.id);
		if (!item || away > 3 * 3600 * 1000 || item.mine > 0 || item.myChip > 0 || isTaken(item)) return;
		const name = item.title.length > 20 ? `${item.title.slice(0, 18).trimEnd()}…` : item.title;
		toast(`Did you get “${name}”?`, { label: 'Mark it mine', run: () => claim(item.id) }, 12000);
	}
	onMount(() => {
		backFromShop();
		document.addEventListener('visibilitychange', backFromShop);
		addEventListener('pageshow', backFromShop);
		return () => {
			document.removeEventListener('visibilitychange', backFromShop);
			removeEventListener('pageshow', backFromShop);
		};
	});

	function claim(id: string) {
		claimingId = id;
		nameOpen = true;
	}
	// Each claim sheet needs its own form id when several of these are on one page.
	const uid = $props.id();
	const formId = `claim-${uid}`;
</script>

{#snippet bow(cls: string, delay: number)}
	<!-- The bow that ties the ribbons off. -->
	<svg class="pointer-events-none absolute {cls}" style="animation-delay: {delay}ms" width="46" height="34" viewBox="0 0 46 34" aria-hidden="true">
		<g stroke="#2B1D14" stroke-width="2" stroke-linejoin="round" fill="#7CC2BA">
			<path d="M21 15 C 9 2, 1 6, 4 14 C 6 21, 14 20, 21 17 Z" />
			<path d="M25 15 C 37 2, 45 6, 42 14 C 40 21, 32 20, 25 17 Z" />
			<path d="M20 18 L 13 32 L 18 30 L 20 33 L 23 20 Z" fill="#3E8E87" />
			<path d="M26 18 L 33 32 L 28 30 L 26 33 L 23 20 Z" fill="#3E8E87" />
			<rect x="18.5" y="12" width="9" height="8" rx="3" fill="#3E8E87" />
		</g>
	</svg>
{/snippet}

{#if lane.length}
	<!-- Most wanted: their top few, big, first. -->
	<section class="mb-5" aria-label="Most wanted">
		<h2 class="mb-2.5 flex items-center gap-2 text-sm font-bold text-fg-faint"><Icon name="heart" size={15} class="text-rust-300" />Most wanted</h2>
		<div class="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0" data-no-swipe>
			{#each lane as item, k (item.id)}
				<button class="gift-hover card relative w-[58%] shrink-0 snap-start overflow-hidden text-left sm:w-auto {isTaken(item) ? 'opacity-50' : ''}" onclick={() => openDetail(item.id)}>
					<ProductImage src={item.image_url} alt={item.title} size={360} icon={catIcon(item.category_id)} seed={item.id} class="aspect-[4/3] w-full" />
					<Rosette place={(k + 1) as 1 | 2 | 3} size={40} class="absolute top-2 left-2 -rotate-6" />
					<span class="block p-3">
						<span class="line-clamp-1 font-bold">{item.title}</span>
						<span class="mt-0.5 flex items-center justify-between gap-2 text-sm">
							<span class="font-bold text-mustard-400 tabular-nums">{formatPrice(item.price_cents, item.currency) || '—'}</span>
							{#if item.mine > 0 || item.myChip > 0}<span class="text-xs font-bold text-teal-300">Yours</span>{:else if isTaken(item)}<span class="text-xs font-bold text-fg-faint">Taken</span>{/if}
						</span>
					</span>
				</button>
			{/each}
		</div>
	</section>
{/if}

{#snippet giftCard(item: GiverItem, i: number)}
		{@const taken = isTaken(item)}
		{@const fresh = celebrating === item.id}
		<article class="gift-hover card rise relative flex flex-col transition {taken ? 'opacity-50' : ''}" style="--i: {i}">
			<button type="button" class="relative block p-1.5 pb-0 text-left sm:p-2 sm:pb-0" aria-label="More about {item.title}" onclick={() => openDetail(item.id)}>
				<ProductImage src={item.image_url} alt={item.title} size={280} icon={catIcon(item.category_id)} seed={item.id} class="aspect-square w-full rounded-[12px]" />
				{#if item.mine > 0}
					<!-- Yours: wrapped in a teal ribbon. -->
					<div class="pointer-events-none absolute inset-x-2 top-2 bottom-0 overflow-hidden rounded-[12px]" aria-hidden="true">
						<div class="absolute inset-x-0 top-[46%] h-4 bg-teal-500 {fresh ? 'ribbon-x' : ''}" style={fresh ? 'animation-delay: 620ms' : ''}></div>
						<div class="absolute inset-y-0 left-[62%] w-4 bg-teal-500 {fresh ? 'ribbon-y' : ''}" style={fresh ? 'animation-delay: 800ms' : ''}></div>
						{#if fresh}<div class="wrap-up paper-grain absolute inset-0" style="background: {paperFor(null, 'general').background}"></div>{/if}
					</div>
					{@render bow(`left-[calc(62%-15px)] top-[calc(46%-9px)] z-10 ${fresh ? 'bow-tie' : ''}`, fresh ? 1000 : 0)}
				{/if}
				{#if fresh}<Confetti {fire} />{/if}
			</button>
			{#if item.mine > 0}
				<Sticker tone="teal" tilt={-5} class="absolute top-3.5 left-3.5 {fresh ? 'stamp' : ''}">You’re getting this</Sticker>
			{:else if taken}
				<Sticker tone="cocoa" tilt={-5} class="absolute top-3.5 left-3.5">Taken</Sticker>
			{/if}
			{#if hasPriceDrop(item) && !taken}
				<Sticker tone="mustard" tilt={5} class="absolute top-3.5 right-3.5">Price drop</Sticker>
			{/if}
			<div class="flex flex-1 flex-col gap-1.5 p-2.5 pt-2 sm:gap-2 sm:p-3.5 sm:pt-3">
				<button type="button" class="text-left" onclick={() => openDetail(item.id)}>
					<h3 class="line-clamp-2 text-[14px] leading-snug font-bold sm:text-[15px]">{item.title}</h3>
				</button>
				{#if item.specifics.length || item.quantity > 1}
					<div class="flex flex-wrap gap-1">
						{#each item.specifics.slice(0, 3) as s, i (i)}<span class="pill">{s.value}</span>{/each}
						{#if item.quantity > 1}<span class="pill">{item.claimed}/{item.quantity} taken</span>{/if}
					</div>
				{/if}
				{#if item.note}<p class="line-clamp-2 text-xs text-fg-muted italic">“{item.note}”</p>{/if}
				<div class="mt-auto space-y-2 pt-0.5">
					<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
						<span class="price-tag text-[14px] font-bold tabular-nums sm:text-base">{formatPrice(item.price_cents, item.currency) || '—'}</span>
						{#if item.rating}<Stars value={item.rating} size={13} />{/if}
					</div>
					{#if item.url}
						<a href={item.url} target="_blank" rel="noopener noreferrer" onclick={() => wentToShop(item)} class="-my-1 flex min-h-9 items-center gap-1 truncate text-xs font-bold text-fg-faint hover:text-teal-300"><span class="truncate">{item.store ?? 'See it in the shop'}</span><Icon name="external" size={12} /></a>
					{/if}
					{#if !preview && item.chipped > 0 && item.price_cents}
						<!-- Chipping in: how much of it is covered so far. -->
						<div>
							<div class="h-2 overflow-hidden rounded-full bg-cocoa-800"><div class="h-full rounded-full bg-teal-500 transition-[width] duration-500" style="width: {Math.min(100, (item.chipped / item.price_cents) * 100)}%"></div></div>
							<p class="mt-1 text-[11px] font-bold text-fg-faint">{covered(item) ? 'All covered' : `${formatPrice(item.chipped, item.currency)} of ${formatPrice(item.price_cents, item.currency)}`} · {item.chippers} chipping in</p>
						</div>
					{/if}
					{#if preview}
						<!-- The owner's preview: no claiming. -->
					{:else if item.mine > 0}
						<form method="POST" action="?/unclaim" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<button class="btn-ghost w-full text-sm">Undo</button>
						</form>
					{:else if item.myChip > 0}
						<form method="POST" action="?/uncontribute" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<button class="btn-ghost w-full text-sm">Your {formatPrice(item.myChip, item.currency)} · Undo</button>
						</form>
					{:else if !taken && item.chipped > 0}
						<button class="btn-teal w-full text-sm" onclick={() => chipIn(item.id)}>Chip in</button>
					{:else if !taken}
						<button class="btn-teal w-full text-sm" onclick={() => claim(item.id)}>I’ll get this</button>
						{#if splittable(item)}<button class="-mt-1 w-full text-center text-xs font-bold text-fg-faint underline decoration-dotted underline-offset-4 hover:text-fg" onclick={() => chipIn(item.id)}>Split it with others</button>{/if}
					{/if}
				</div>
			</div>
		</article>
{/snippet}

<!-- Givers see what's left to pick first: yours on top, then everything still free, then the
     ones already taken folded away at the bottom. -->
{#if mine.length}
	<section class="mb-6" aria-label="You’re getting">
		<h2 class="mb-2.5 flex items-center gap-2 text-sm font-bold text-teal-300"><Icon name="gift" size={15} />You’re getting {mine.length === 1 ? 'this' : `these ${mine.length}`}</h2>
		<div class="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each mine as item, i (item.id)}<div class="grid" in:fly|global={{ y: -20, duration: dur(260) }}>{@render giftCard(item, i)}</div>{/each}
		</div>
	</section>
{/if}

<div class="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
	{#each open as item, i (item.id)}<div class="grid" animate:flip={{ duration: dur(260) }} out:scale={{ start: 0.85, duration: dur(220) }}>{@render giftCard(item, i)}</div>{/each}
</div>

{#if taken.length && !preview}
	<!-- Already taken: folded into one strip at the bottom; tap to look. -->
	<section class="mt-8" aria-label="Already taken">
		<button class="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-4 text-left transition hover:border-cocoa-600" aria-expanded={showTaken} onclick={() => (showTaken = !showTaken)}>
			<span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cocoa-800 text-fg-faint"><Icon name="check" size={16} /></span>
			<span class="min-w-0 flex-1"><span class="block font-bold">Already taken ({taken.length})</span><span class="block text-xs text-fg-faint">Someone’s getting {taken.length === 1 ? 'this one' : 'these'}, so you don’t have to</span></span>
			<span class="text-sm font-bold text-fg-faint">{showTaken ? 'Hide' : 'Show'}</span>
			<Icon name="chevron-down" size={18} class="shrink-0 text-fg-faint transition-transform duration-300 {showTaken ? 'rotate-180' : ''}" />
		</button>
		{#if showTaken}
			<div class="mt-3 grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" transition:fly={{ y: -10, duration: dur(200) }}>
				{#each taken as item, i (item.id)}{@render giftCard(item, i)}{/each}
			</div>
		{/if}
	</section>
{/if}


<!-- One gift, in full. -->
<Modal bind:open={detailOpen}>
	{#snippet header()}
		<div class="flex items-center justify-between px-5 pt-2 sm:px-6 sm:pt-4">
			<span class="text-xs font-bold tracking-wider text-fg-faint uppercase">Gift</span>
			<button type="button" class="btn-quiet -mr-2 w-11 px-0" aria-label="Close" onclick={() => (detailOpen = false)}><Icon name="close" size={20} /></button>
		</div>
	{/snippet}
	{#if detail}
		{@const taken = isTaken(detail)}
		<div class="-mt-3">
			<div class="relative">
				<ProductImage src={detail.image_url} alt={detail.title} size={640} icon={catIcon(detail.category_id)} seed={detail.id} class="aspect-[4/3] w-full rounded-[18px]" />
				<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
					{#if detail.mine > 0}<Sticker tone="teal" tilt={-4}>You’re getting this</Sticker>{:else if taken}<Sticker tone="cocoa" tilt={-4}>Taken</Sticker>{/if}
					{#if detail.availability === 'out_of_stock'}<Sticker tone="rust" tilt={3}>Sold out</Sticker>{:else if hasPriceDrop(detail)}<Sticker tone="mustard" tilt={3}>Price drop</Sticker>{/if}
				</div>
			</div>
			<h2 class="display mt-4 text-[26px] leading-tight break-words">{detail.title}</h2>
			<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
				<span class="flex items-baseline gap-2">
					{#if detail.price_cents != null}<span class="text-2xl font-bold tabular-nums">{formatPrice(detail.price_cents, detail.currency)}</span>{/if}
					{#if hasPriceDrop(detail)}<s class="text-sm text-fg-faint tabular-nums">{formatPrice(detail.prev_price_cents, detail.currency)}</s>{/if}
				</span>
				{#if detail.rating}<span class="flex items-center gap-2 text-xs font-bold text-fg-faint">How much they want it <Stars value={detail.rating} size={16} /></span>{/if}
			</div>

			{#if detail.note}
				<blockquote class="mt-4 rounded-[16px] bg-cocoa-850 px-4 py-3 text-[15px] italic text-fg">“{detail.note}”</blockquote>
			{/if}

			{#if detail.specifics.length || detail.quantity > 1}
				<dl class="mt-4 grid grid-cols-2 gap-2">
					{#each detail.specifics as sp, i (i)}
						<div class="rounded-[14px] bg-cocoa-850 px-3.5 py-2.5"><dt class="text-xs font-bold text-fg-faint">{sp.label}</dt><dd class="font-bold">{sp.value}</dd></div>
					{/each}
					{#if detail.quantity > 1}
						<div class="rounded-[14px] bg-cocoa-850 px-3.5 py-2.5"><dt class="text-xs font-bold text-fg-faint">Wants</dt><dd class="font-bold">{detail.quantity} · {detail.claimed} taken</dd></div>
					{/if}
				</dl>
			{/if}

			{#if detail.description}
				<h3 class="mt-5 mb-1.5 text-sm font-bold text-fg-faint">About it</h3>
				<p class="text-sm leading-relaxed whitespace-pre-line text-fg-muted">{detail.description}</p>
			{/if}

			{#if detail.url}
				<a href={detail.url} target="_blank" rel="noopener noreferrer" onclick={() => detail && wentToShop(detail)} class="btn-ghost mt-5 w-full">See it at {detail.store ?? 'the shop'}<Icon name="external" size={15} /></a>
			{/if}

			{#if !preview && (detail.mine > 0 || detail.myChip > 0)}
				<!-- A note to yourself about it: only you ever see this. -->
				<form
					method="POST"
					action="?/note"
					class="mt-5 rounded-[16px] bg-teal-600/15 p-3.5"
					use:enhance={() => async ({ update, result }) => {
						await update({ reset: false });
						noteSaved = result.type === 'success';
					}}
				>
					<input type="hidden" name="id" value={detail.id} />
					<label class="block">
						<span class="label flex items-center gap-1.5 text-teal-300"><Icon name="tag" size={13} />Your note <span class="normal-case text-fg-faint">(only you see this)</span></span>
						<div class="flex gap-2">
							<input class="field" name="note" maxlength="200" placeholder="Ordered · arrives the 12th · wrap in blue" bind:value={noteDraft} oninput={() => (noteSaved = false)} />
							<button class="btn-teal shrink-0 px-3.5 text-sm">{noteSaved ? 'Saved' : 'Save'}</button>
						</div>
					</label>
				</form>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		{#if detail}
			{@const taken = isTaken(detail)}
			{#if preview}
				<p class="text-center text-sm text-fg-muted">Givers tap <span class="font-bold text-teal-300">I’ll get this</span> here.</p>
			{:else if detail.mine > 0}
				<form method="POST" action="?/unclaim" use:enhance={() => async ({ update }) => { await update(); detailOpen = false; }}>
					<input type="hidden" name="id" value={detail.id} />
					<button class="btn-ghost w-full">You’re getting this · Undo</button>
				</form>
			{:else if detail.myChip > 0}
				<form method="POST" action="?/uncontribute" use:enhance={() => async ({ update }) => { await update(); detailOpen = false; }}>
					<input type="hidden" name="id" value={detail.id} />
					<button class="btn-ghost w-full">You’re putting in {formatPrice(detail.myChip, detail.currency)} · Undo</button>
				</form>
			{:else if taken}
				<p class="text-center text-sm font-bold text-fg-muted">{covered(detail) ? 'It’s all covered by people chipping in.' : 'Someone’s already getting this one.'}</p>
			{:else if detail.chipped > 0}
				<button class="btn-teal w-full" onclick={() => { const id = detail.id; detailOpen = false; setTimeout(() => chipIn(id), 200); }}>Chip in · {formatPrice(left(detail), detail.currency)} to go</button>
			{:else}
				<div class="flex gap-2">
					<button class="btn-teal flex-1" onclick={() => { const id = detail.id; detailOpen = false; setTimeout(() => claim(id), 200); }}>I’ll get this</button>
					{#if splittable(detail)}<button class="btn-ghost" onclick={() => { const id = detail.id; detailOpen = false; setTimeout(() => chipIn(id), 200); }}>Split it</button>{/if}
				</div>
			{/if}
		{/if}
	{/snippet}
</Modal>

<Modal bind:open={nameOpen} title="I’ll get this">
	<form
		id={formId}
		method="POST"
		action="?/claim"
		use:enhance={() => async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				nameOpen = false;
				celebrating = claimingId;
				fire++;
			}
		}}
	>
		<input type="hidden" name="id" value={claimingId} />
		{#if claimingItem}
			<p class="mb-5 text-sm text-fg-muted">Marking <span class="font-bold text-fg">{claimingItem.title}</span> as yours. Other givers will see it’s taken. The list owner won’t.</p>
		{/if}
		<label class="block">
			<span class="label">Your name <span class="normal-case text-fg-faint">(optional)</span></span>
			<input class="field" name="name" maxlength="40" placeholder="So other givers know it’s you" bind:value={name} />
		</label>
		{#if error && nameOpen}<p class="mt-3 text-sm font-bold text-rust-300">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (nameOpen = false)}>Cancel</button>
			<button form={formId} class="btn-teal">It’s mine</button>
		</div>
	{/snippet}
</Modal>

<!-- Chipping in on a pricey gift: how much you'll put in. -->
<Modal bind:open={chipOpen} title="Chip in">
	<form
		id="{formId}-chip"
		method="POST"
		action="?/contribute"
		use:enhance={() => async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				chipOpen = false;
				celebrating = chipId;
				fire++;
			}
		}}
	>
		<input type="hidden" name="id" value={chipId} />
		{#if chipItem}
			<p class="mb-4 text-sm text-fg-muted">
				Going in together on <span class="font-bold text-fg">{chipItem.title}</span>
				({formatPrice(chipItem.price_cents, chipItem.currency)}){#if chipItem.chipped > 0}: {formatPrice(chipItem.chipped, chipItem.currency)} is covered by {chipItem.chippers} {chipItem.chippers === 1 ? 'person' : 'people'} so far{/if}.
				Other givers see how much is left. The list owner never sees any of it.
			</p>
			<span class="label">Your part</span>
			<input class="field text-2xl font-bold tabular-nums" name="amount" inputmode="decimal" required bind:value={amount} aria-label="Your part" />
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each picks as pk (pk.cents)}
					<button type="button" class="chip min-h-9 text-xs {Math.round(Number(amount) * 100) === pk.cents ? 'chip-on' : 'hover:text-fg'}" onclick={() => (amount = (pk.cents / 100).toFixed(pk.cents % 100 ? 2 : 0))}>{pk.label} · {formatPrice(pk.cents, chipItem.currency)}</button>
				{/each}
			</div>
		{/if}
		<label class="mt-5 block">
			<span class="label">Your name</span>
			<input class="field" name="name" maxlength="40" placeholder="So the others know who’s in (optional)" bind:value={name} />
		</label>
		{#if error && chipOpen}<p class="mt-3 text-sm font-bold text-rust-300">{error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (chipOpen = false)}>Cancel</button>
			<button form="{formId}-chip" class="btn-teal">I’m in</button>
		</div>
	{/snippet}
</Modal>
