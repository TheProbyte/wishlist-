<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ItemEditor, { type Draft } from '#lib/components/ItemEditor.svelte';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import Present from '#lib/components/Present.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { formatPrice, occasionMeta } from '#lib/format.ts';
	import type { ImportResult } from '#lib/types.ts';
	import type { PageProps } from './$types';

	/**
	 * Add a gift from anywhere: a pasted link (?url=), the phone's share menu (?url= / ?text=),
	 * or the "Add to The Giver" bookmark (#{...} with what it read from the page, or a whole
	 * Amazon wish list).
	 */
	let { data, form }: PageProps = $props();

	type Phase = 'empty' | 'loading' | 'gift' | 'wishlist' | 'done';
	let phase = $state<Phase>('loading');
	let notice = $state<string | null>(null);
	let draft = $state<Draft | null>(null);
	let editorOpen = $state(false);
	let wishlist = $state<(ImportResult & { pick: boolean })[]>([]);
	// svelte-ignore state_referenced_locally
	let scopeId = $state(data.scopes[0].id);
	let importLists = $state<string[]>([]);
	let doneMessage = $state('');
	let importing = $state(false);

	const scope = $derived(data.scopes.find((s) => s.id === scopeId) ?? data.scopes[0]);
	const picked = $derived(wishlist.filter((w) => w.pick));

	function firstUrl(text: string | null): string | null {
		return text?.match(/https?:\/\/\S+/)?.[0] ?? null;
	}

	async function load(body: unknown) {
		phase = 'loading';
		try {
			const res = await fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			const r = (await res.json()) as ImportResult & { kind: 'gift' | 'wishlist'; items?: ImportResult[]; error?: string };
			if (r.kind === 'wishlist') {
				wishlist = (r.items ?? []).map((i) => ({ ...i, pick: true }));
				notice = r.error ?? null;
				phase = wishlist.length ? 'wishlist' : 'empty';
				return;
			}
			draft = {
				url: r.url,
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
			phase = 'gift';
			editorOpen = true;
		} catch {
			notice = 'Couldn’t reach the shop. You can still add it by hand.';
			draft = { url: firstUrl(JSON.stringify(body)) ?? '', title: '' };
			phase = 'gift';
			editorOpen = true;
		}
	}

	onMount(() => {
		// From the bookmark: everything it read is in the hash.
		if (location.hash.length > 1) {
			let fromPage: Record<string, unknown> | null = null;
			try {
				fromPage = JSON.parse(decodeURIComponent(location.hash.slice(1)));
			} catch {
				/* not ours */
			}
			history.replaceState(null, '', location.pathname);
			if (fromPage && Array.isArray(fromPage.items)) return void load({ items: fromPage.items });
			if (fromPage && typeof fromPage.url === 'string') return void load({ url: fromPage.url, hint: fromPage });
		}
		const params = page.url.searchParams;
		// "Add by hand" from the + menu: straight into a blank gift.
		if (params.has('manual')) {
			manual = true;
			draft = { title: '' };
			phase = 'gift';
			editorOpen = true;
			return;
		}
		// From a pasted link or the share menu.
		const url = firstUrl(params.get('url')) ?? firstUrl(params.get('text')) ?? (params.get('url') || null);
		if (url) return void load({ url });
		phase = 'empty';
	});

	// Adding by hand and changing your mind: closing the sheet takes you back where you were,
	// rather than leaving you on an empty page.
	let manual = $state(false);
	let saved = false;
	$effect(() => {
		if (!manual || editorOpen || saved) return;
		manual = false;
		if (history.length > 1) history.back();
		else goto('/');
	});

	function savedGift() {
		saved = true;
		doneMessage = `Added to ${scope.id === data.scopes[0].id ? 'your' : `${scope.name}’s`} wish list.`;
		phase = 'done';
	}
</script>

<svelte:head><title>Add a gift · The Giver</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<h1 class="display mb-6 text-[38px] leading-tight">Add a gift</h1>

	{#if data.scopes.length > 1 && phase !== 'done'}
		<div class="mb-6">
			<span class="label">Who’s it for?</span>
			<div class="flex flex-wrap gap-2">
				{#each data.scopes as s (s.id)}
					<button class="chip {scopeId === s.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={scopeId === s.id} onclick={() => { scopeId = s.id; importLists = []; }}>
						<Icon name={s.id === data.scopes[0].id ? 'gift' : 'teddy'} size={15} />{s.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if phase === 'loading'}
		<div class="card p-6">
			<div class="stripes-run mb-5 h-1.5 rounded-full" role="progressbar" aria-label="Reading the shop page"></div>
			<p class="text-fg-muted">Reading the shop page…</p>
			<p class="mt-1 text-sm text-fg-faint">A long wish list takes a few seconds: every page of it is read.</p>
		</div>
	{:else if phase === 'empty'}
		<form
			method="GET"
			class="card p-5"
			onsubmit={(e) => {
				// Handle it here: the page is already open, so it wouldn't reload by itself.
				e.preventDefault();
				const value = String(new FormData(e.currentTarget).get('url') ?? '').trim();
				if (!value) return;
				history.replaceState(null, '', `/add?url=${encodeURIComponent(value)}`);
				notice = null;
				load({ url: firstUrl(value) ?? value });
			}}
		>
			{#if notice}<p class="mb-4 flex gap-2 text-sm font-medium text-rust-300"><Icon name="alert" size={18} />{notice}</p>{/if}
			<label class="block">
				<span class="label">Link to the gift, or to an Amazon wish list</span>
				<div class="flex gap-2">
					<input class="field" name="url" required placeholder="https://" />
					<button class="btn-primary shrink-0">Add</button>
				</div>
			</label>
			<p class="mt-4 text-sm text-fg-faint">Tip: add gifts straight from any shop with the bookmark button or your phone’s share menu. Set them up on the <a href="/me#anywhere" class="font-bold text-mustard-400 hover:underline">You</a> page.</p>
		</form>
	{:else if phase === 'gift'}
		<div class="card flex items-center gap-4 p-4">
			<ProductImage src={draft?.image_url} size={80} class="h-20 w-20 shrink-0 rounded-[12px]" />
			<div class="min-w-0 flex-1">
				<p class="line-clamp-2 font-bold">{draft?.title || 'New gift'}</p>
				{#if draft?.price_cents != null}<p class="text-sm text-fg-muted">{formatPrice(draft.price_cents, draft.currency)}</p>{/if}
			</div>
			<button class="btn-primary shrink-0" onclick={() => (editorOpen = true)}>Review &amp; add</button>
		</div>
	{:else if phase === 'wishlist'}
		<form
			method="POST"
			action="?/importMany"
			use:enhance={() => {
				importing = true;
				return async ({ result, update }) => {
				importing = false;
				await update({ reset: false });
				if (result.type === 'success') {
					const d = result.data as { imported: number; skipped: number };
					doneMessage = `Added ${d.imported} ${d.imported === 1 ? 'gift' : 'gifts'}${d.skipped ? ` (${d.skipped} were already there)` : ''}.`;
					phase = 'done';
				} else {
					notice = 'Couldn’t add those just now. Try again in a moment.';
				}
			};
			}}
		>
			<input type="hidden" name="scope" value={scope.id} />
			<input type="hidden" name="items" value={JSON.stringify(picked.map((w) => ({ url: w.url, title: w.title, image_url: w.image_url, price_cents: w.price_cents, currency: w.currency, store: w.store, category_id: w.category_id })))} />
			{#each importLists as l (l)}<input type="hidden" name="in_list" value={l} />{/each}

			<div class="card mb-5 p-4">
				<p class="font-bold">Found {wishlist.length} {wishlist.length === 1 ? 'gift' : 'gifts'} on that wish list</p>
				<p class="mt-1 text-sm text-fg-muted">Untick any you don’t want. They’ll go in {scope.id === data.scopes[0].id ? 'your' : `${scope.name}’s`} Everything list{scope.lists.length ? ', and on any lists you pick below' : ''}.</p>
				{#if scope.lists.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each scope.lists as l (l.id)}
							{@const on = importLists.includes(l.id)}
							<button type="button" class="chip {on ? 'chip-on' : 'hover:text-fg'}" aria-pressed={on} onclick={() => (importLists = on ? importLists.filter((x) => x !== l.id) : [...importLists, l.id])}>
								<Icon name={on ? 'check' : occasionMeta(l.occasion).icon} size={15} />{l.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each wishlist as w, i (i)}
					<label class="card relative cursor-pointer p-2 ring-3 transition {w.pick ? 'ring-mustard-400' : 'opacity-50 ring-transparent'}">
						<input type="checkbox" class="sr-only" bind:checked={w.pick} />
						<ProductImage src={w.image_url} size={200} seed={w.url ?? w.title ?? ''} class="aspect-square w-full rounded-[12px]" />
						<span class="mt-2 line-clamp-2 block px-1 text-sm font-bold">{w.title}</span>
						{#if w.price_cents != null}<span class="block px-1 pb-1 text-sm text-fg-muted">{formatPrice(w.price_cents, w.currency)}</span>{/if}
						{#if w.pick}<span class="absolute top-4 right-4 grid h-7 w-7 place-items-center rounded-full bg-mustard-400 text-cocoa-950"><Icon name="check" size={16} /></span>{/if}
					</label>
				{/each}
			</div>
			<div class="sticky bottom-20 mt-6 flex justify-end sm:bottom-4">
				<button class="btn-primary relative overflow-hidden shadow-[0_8px_24px_-6px_rgb(0_0_0/0.6)]" disabled={!picked.length || importing}>
					{#if importing}<span class="stripes-run absolute inset-x-0 bottom-0 h-1"></span>{/if}
					{importing ? `Adding ${picked.length}…` : `Add ${picked.length} ${picked.length === 1 ? 'gift' : 'gifts'}`}
				</button>
			</div>
		</form>
	{:else if phase === 'done'}
		<div class="card overflow-hidden">
			<Present occasion="birthday" class="h-32 rounded-t-[var(--radius-card)]" />
			<div class="p-6 text-center">
				<h2 class="display text-3xl">Wrapped!</h2>
				<p class="mt-2 text-fg-muted">{doneMessage}</p>
				<div class="mt-6 flex flex-wrap justify-center gap-2">
					<a href="/lists/{scope.master}" class="btn-primary">See the list</a>
					<button class="btn-ghost" onclick={() => { history.replaceState(null, '', '/add'); notice = null; phase = 'empty'; }}>Add another</button>
				</div>
			</div>
		</div>
	{/if}
</div>

{#key scopeId}
	<ItemEditor
		bind:open={editorOpen}
		{draft}
		{notice}
		categories={data.categories}
		lists={scope.lists}
		sizes={scope.sizes}
		extra={{ scope: scope.id }}
		saveLabel="Add gift"
		onsaved={savedGift}
	/>
{/key}
{#if form?.error && phase === 'gift'}<p class="mt-4 text-center text-sm font-bold text-rust-300">{form.error}</p>{/if}
