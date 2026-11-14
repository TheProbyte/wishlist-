<script lang="ts">
	import EmptyArt from '#lib/components/EmptyArt.svelte';
	import { invalidateAll } from '$app/navigation';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Present from '#lib/components/Present.svelte';
	import { countdownLabel, formatDate, formatPrice, withKid } from '#lib/format.ts';
	import { undoable, isHidden } from '#lib/undo.svelte.ts';
	import type { PageProps } from './$types';

	/**
	 * Your shopping list: who you're getting for, soonest first; each gift claimed → ordered →
	 * wrapped with one tap; what you've spent and what's left; and a flag when a day is close and
	 * something isn't ordered yet.
	 */
	let { data }: PageProps = $props();

	const STAGES = ['Claimed', 'Ordered', 'Wrapped'] as const;
	// Where each gift is up to: shown at once when tapped, saved behind.
	let stages = $state<Record<string, number>>({});
	const stageOf = (c: (typeof data.claims)[number]) => stages[c.claim_id] ?? (c.wrapped ? 2 : c.purchased ? 1 : 0);
	// Wrapped just now: these get wrapped in front of you (the others are simply wrapped already).
	let justWrapped = $state<string[]>([]);

	async function post(action: string, body: Record<string, string>) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(body)) fd.set(k, v);
		await fetch(`/getting?/${action}`, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
	}
	function setStage(c: (typeof data.claims)[number], k: number) {
		// Tapping the step it's already on steps back one.
		const next = stageOf(c) === k ? k - 1 : k;
		if (next === 2) justWrapped = [...justWrapped, c.claim_id];
		stages[c.claim_id] = Math.max(0, next);
		post('stage', { claim: c.claim_id, stage: String(Math.max(0, next)) }).then(() => invalidateAll());
	}

	// Notes to yourself, edited right in the row.
	let editing = $state<string | null>(null);
	let draft = $state('');
	let notes = $state<Record<string, string | null>>({});
	function editNote(id: string, current: string | null) {
		editing = id;
		draft = current ?? '';
	}
	function saveNote(kind: 'claim' | 'chip', id: string) {
		notes[id] = draft.trim() || null;
		editing = null;
		post('note', { kind, id, note: draft });
	}

	function letGo(kind: 'claim' | 'chip', id: string, title: string) {
		undoable({
			message: kind === 'chip' ? `Took back your part of “${title.slice(0, 26)}”` : `Not getting “${title.slice(0, 26)}”`,
			requests: [{ url: '/getting?/release', body: { kind, id, claim: id } }],
			keys: [`${kind}:${id}`],
			revert: () => {},
			done: (ok) => ok && invalidateAll()
		});
	}

	const claims = $derived(data.claims.filter((c) => !isHidden(`claim:${c.claim_id}`)));
	const chips = $derived(data.chips.filter((c) => !isHidden(`chip:${c.chip_id}`)));

	// One group per person (a kid counts as their own person), soonest occasion first.
	type Next = (typeof data.claims)[number]['next'];
	const groups = $derived.by(() => {
		const map = new Map<string, { key: string; name: string; avatar: string | null; sticker: string | null; paper: string | null; next: Next; claims: typeof claims; chips: typeof chips }>();
		const group = (c: { owner_id: string; kid_name: string | null; owner_name: string; owner_avatar: string | null; owner_sticker: string | null; paper: string | null; next: Next }) => {
			const key = c.owner_id + (c.kid_name ?? '');
			if (!map.has(key))
				map.set(key, {
					key,
					name: c.kid_name ? `${c.kid_name} (${c.owner_name.split(' ')[0]}’s)` : c.owner_name,
					avatar: c.kid_name ? null : c.owner_avatar,
					sticker: c.kid_name ? null : c.owner_sticker,
					paper: c.paper,
					next: c.next,
					claims: [],
					chips: []
				});
			return map.get(key)!;
		};
		for (const c of claims) group(c).claims.push(c);
		for (const c of chips) group(c).chips.push(c);
		return [...map.values()].sort((a, b) => (a.next?.days ?? 9999) - (b.next?.days ?? 9999));
	});

	const total = $derived(claims.length + chips.length);
	const wrappedCount = $derived(claims.filter((c) => stageOf(c) === 2).length);
	const toOrder = $derived(claims.filter((c) => stageOf(c) === 0));
	const cents = (c: { price_cents: number | null; quantity?: number }) => (c.price_cents ?? 0) * (c.quantity ?? 1);
	const currency = $derived(claims[0]?.currency ?? chips[0]?.currency ?? 'USD');
	const spent = $derived(claims.filter((c) => stageOf(c) > 0).reduce((n, c) => n + cents(c), 0) + chips.reduce((n, c) => n + c.amount_cents, 0));
	const left = $derived(toOrder.reduce((n, c) => n + cents(c), 0));
	/** Under a week to go and something isn't ordered yet. */
	const urgent = (g: (typeof groups)[number]) => (g.next?.days ?? 99) <= 7 ? g.claims.filter((c) => stageOf(c) === 0).length : 0;
</script>

<svelte:head><title>Gifts I’m getting · The Giver</title></svelte:head>

<a href="/people" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />People</a>

<section class="mb-8">
	<h1 class="display accent-bar text-[38px] leading-[1.05]">Gifts I’m getting</h1>
	{#if total}
		<!-- The wrapping table: how far along you are, what you've spent and what's left. -->
		<div class="mt-5 flex items-center gap-3">
			<div class="relative h-3 flex-1 overflow-hidden rounded-full bg-cocoa-850">
				<div class="stripes-run absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]" style="width: {claims.length ? (wrappedCount / claims.length) * 100 : 0}%; animation-play-state: paused"></div>
			</div>
			<span class="shrink-0 text-sm font-bold">{wrappedCount} of {claims.length} wrapped</span>
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			<GiftTag tone={toOrder.length ? 'rust' : 'teal'}>{toOrder.length ? `${toOrder.length} still to order` : 'All ordered!'}</GiftTag>
			{#if spent}<GiftTag tone="cream">{formatPrice(spent, currency)} spent</GiftTag>{/if}
			{#if left}<GiftTag tone="mustard">about {formatPrice(left, currency)} to go</GiftTag>{/if}
		</div>
	{/if}
</section>

{#if total === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<EmptyArt class="mx-auto mb-3" />
		<h2 class="display text-2xl">Nothing claimed yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">When you tap “I’ll get this” (or chip in) on someone’s list, it lands here, with a checklist to see it through to wrapped.</p>
	</div>
{/if}

{#snippet noteLine(kind: 'claim' | 'chip', id: string, note: string | null)}
	{@const shown = id in notes ? notes[id] : note}
	{#if editing === id}
		<form class="mt-1.5 flex gap-1.5" onsubmit={(e) => { e.preventDefault(); saveNote(kind, id); }}>
			<!-- svelte-ignore a11y_autofocus -->
			<input class="field min-h-9 py-1.5 text-sm" maxlength="200" placeholder="Ordered · arrives the 12th" bind:value={draft} autofocus aria-label="Your note" />
			<button class="btn-teal min-h-9 shrink-0 px-3 text-xs">Save</button>
		</form>
	{:else}
		<button class="mt-1 flex max-w-full items-center gap-1 text-left text-xs {shown ? 'text-fg-muted' : 'text-fg-faint'} hover:text-fg" onclick={() => editNote(id, shown)}>
			<Icon name="tag" size={12} class="shrink-0" /><span class="truncate">{shown ?? 'Add a note (only you see it)'}</span>
		</button>
	{/if}
{/snippet}

{#each groups as g (g.key)}
	{@const flag = urgent(g)}
	<section class="mb-10">
		<header class="mb-3 flex items-center gap-2.5">
			<Avatar name={g.name} src={g.avatar} sticker={g.sticker} size={36} />
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-lg leading-tight font-bold">{g.name}</h2>
				{#if g.next}<p class="truncate text-xs font-bold text-fg-faint">{withKid(g.next.kid, g.next.label)} · {formatDate(g.next.date)}</p>{/if}
			</div>
			{#if g.next}<GiftTag tone={g.next.days <= 7 ? 'rust' : g.next.days <= 30 ? 'mustard' : 'cream'} tilt={3}>{countdownLabel(g.next.date)}</GiftTag>{/if}
		</header>
		{#if flag}
			<!-- Close and not ordered yet: worth knowing now, not the day before. -->
			<p class="mb-3 flex items-center gap-2 rounded-[14px] bg-rust-500/15 px-3.5 py-2.5 text-sm font-bold text-rust-300"><Icon name="alert" size={17} />Under a week to go: {flag} still to order</p>
		{/if}

		<div class="grid gap-2.5 lg:grid-cols-2">
			{#each g.claims as c (c.claim_id)}
				{@const st = stageOf(c)}
				<div class="card flex gap-3 p-2.5 {st === 2 ? 'opacity-80' : ''}">
					<div class="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[12px]">
						<ProductImage src={c.image_url} size={72} seed={c.id} class="absolute inset-0 h-full w-full" />
						{#if st === 2}
							<div class="absolute inset-0 {justWrapped.includes(c.claim_id) ? 'wrap-close' : ''}">
								<Present wrap={g.paper ?? 'sunburst'} occasion="general" ribbonAt={50} bow={false} class="paper-grain h-full w-full" />
							</div>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-start gap-2">
							<p class="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-bold">{c.title}</p>
							<button class="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center text-fg-faint hover:text-rust-300" aria-label="Not getting {c.title} after all" onclick={() => letGo('claim', c.claim_id, c.title)}><Icon name="close" size={15} /></button>
						</div>
						<div class="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
							{#if c.price_cents != null}<span class="font-bold tabular-nums">{formatPrice(c.price_cents, c.currency)}</span>{/if}
							{#if c.url}<a href={c.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-bold hover:text-teal-300">{c.store ?? 'Shop'}<Icon name="external" size={11} /></a>{/if}
						</div>
						{@render noteLine('claim', c.claim_id, c.note)}
						<!-- Claimed → ordered → wrapped: one tap each, big enough for a thumb. -->
						<div class="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Where it’s up to">
							{#each STAGES as label, k (label)}
								<button
									class="flex min-h-9 items-center justify-center gap-1 rounded-[10px] text-[12px] font-bold transition {k <= st ? (k === 2 ? 'bg-teal-500 text-cocoa-950' : 'bg-teal-600 text-cream') : 'bg-cocoa-800 text-fg-faint hover:text-fg'}"
									aria-pressed={k <= st}
									disabled={k === 0}
									onclick={() => setStage(c, k)}
								>
									{#if k <= st}<Icon name="check" size={13} />{/if}{label}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/each}
			{#each g.chips as c (c.chip_id)}
				<div class="card flex gap-3 p-2.5">
					<div class="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[12px]">
						<ProductImage src={c.image_url} size={72} seed={c.id} class="absolute inset-0 h-full w-full" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-start gap-2">
							<p class="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-bold">{c.title}</p>
							<button class="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center text-fg-faint hover:text-rust-300" aria-label="Take back your part of {c.title}" onclick={() => letGo('chip', c.chip_id, c.title)}><Icon name="close" size={15} /></button>
						</div>
						<p class="text-xs text-fg-muted"><span class="font-bold text-teal-300">Chipping in {formatPrice(c.amount_cents, c.currency)}</span> · {formatPrice(c.covered, c.currency)} of {formatPrice(c.price_cents, c.currency)} covered</p>
						<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cocoa-800"><div class="h-full rounded-full bg-teal-500" style="width: {Math.min(100, (c.covered / Math.max(1, c.price_cents ?? 1)) * 100)}%"></div></div>
						{@render noteLine('chip', c.chip_id, c.note)}
					</div>
				</div>
			{/each}
		</div>
	</section>
{/each}
