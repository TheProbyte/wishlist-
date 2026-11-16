<script lang="ts" module>
	import type { Item, Specific } from '#lib/types.ts';
	export type Draft = Partial<Omit<Item, 'specifics'>> & { specifics?: Specific[]; images?: string[] };
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Modal from './Modal.svelte';
	import Stars from './Stars.svelte';
	import ProductImage from './ProductImage.svelte';
	import Icon from './Icon.svelte';
	import { CURRENCIES, centsToInput, occasionMeta } from '#lib/format.ts';
	import { SIZE_FIELDS, sizeFor } from '#lib/sizes.ts';
	import { uploadPhoto } from '#lib/upload.ts';
	import type { Category, Sizes } from '#lib/types.ts';

	let {
		open = $bindable(false),
		draft,
		loading = false,
		notice = null,
		categories,
		lists = [],
		currentList = null,
		sizes = {},
		saveLabel,
		extra = {},
		onsaved,
		ondrop,
		onfail
	}: {
		open?: boolean;
		draft: Draft | null;
		loading?: boolean;
		notice?: string | null;
		categories: Category[];
		/** Occasion lists the gift can be put on. */
		lists?: { id: string; name: string; occasion: string }[];
		/** The occasion list being viewed, if any (new gifts go on it). */
		currentList?: string | null;
		/** Saved sizes, to fill in clothing sizes. */
		sizes?: Sizes;
		saveLabel?: string;
		/** Extra form fields to send with the gift (e.g. who it's for). */
		extra?: Record<string, string>;
		onsaved?: (id: string) => void;
		/** Delete it, or take it off this list: the page does it (with Undo). */
		ondrop?: (id: string, mode: 'list' | 'everywhere') => void;
		/** ...and is told if the server said no (the page has already been refreshed back). */
		onfail?: (message: string) => void;
	} = $props();

	// Editable copy of the draft. Re-seeded whenever a new draft arrives (e.g. when the import finishes).
	let title = $state('');
	let url = $state('');
	let image = $state('');
	let images = $state<string[]>([]);
	let price = $state('');
	let currency = $state('USD');
	let store = $state('');
	let categoryId = $state('');
	let rating = $state(0);
	let quantity = $state(1);
	let note = $state('');
	let description = $state('');
	let specs = $state<Specific[]>([]);
	let error = $state<string | null>(null);
	function drop(mode: 'list' | 'everywhere') {
		const id = draft?.id;
		open = false;
		if (id) ondrop?.(id, mode);
	}
	let saving = $state(false);
	let showImageUrl = $state(false);
	let onLists = $state<string[]>([]);
	let uploading = $state(false);
	let duplicate = $state<{ id: string; title: string } | null>(null);
	let allowDuplicate = $state(false);
	let form = $state<HTMLFormElement>();
	// Something needs you (already have it, or it couldn't save): bring it into view, since it
	// sits at the end of the form and could be below the screen.
	async function showAttention() {
		await tick();
		requestAnimationFrame(() => {
			const el = form?.querySelector<HTMLElement>('[data-attention]');
			const box = el?.closest<HTMLElement>('.overflow-y-auto');
			if (!el || !box) return;
			const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
			box.scrollTo({ top: Math.max(0, top - (box.clientHeight - el.offsetHeight) / 2), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
		});
	}

	// The second step: folded away until wanted.
	let more = $state(false);

	/* Photos: the big one is a swipeable strip; the filmstrip under it jumps straight to one. */
	let strip = $state<HTMLDivElement>();
	const shown = $derived(images.slice(0, 10));
	function onStripScroll() {
		const el = strip;
		if (!el || !el.clientWidth) return;
		const k = Math.round(el.scrollLeft / el.clientWidth);
		if (shown[k] && shown[k] !== image) image = shown[k];
	}
	function showPhoto(k: number) {
		image = shown[k];
		strip?.scrollTo({ left: k * strip.clientWidth, behavior: 'smooth' });
	}
	// A new gift's pictures: start the strip on the chosen one.
	$effect(() => {
		const el = strip;
		const k = untrack(() => shown.indexOf(image));
		if (el && k > 0) el.scrollLeft = k * el.clientWidth;
	});

	/** The currency's sign, shown in the price field. */
	const symbol = $derived(
		new Intl.NumberFormat('en', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
	);

	/* Saved sizes as chips under Details, for clothes, shoes and jewellery. */
	const sizeChips = $derived(
		['cat_clothes', 'cat_shoes', 'cat_jewelry'].includes(categoryId)
			? SIZE_FIELDS.filter((f) => sizes[f.key]).map((f) => ({ key: f.key, label: f.label, value: sizes[f.key]! }))
			: []
	);
	const sizeValue = $derived(specs.find((x) => x.label.toLowerCase() === 'size')?.value ?? '');
	function useSize(value: string) {
		const row = specs.find((x) => x.label.toLowerCase() === 'size');
		if (row) row.value = value;
		else specs.push({ label: 'Size', value });
	}

	/** What's folded under More details, in a few words. */
	const summary = $derived(
		[
			store,
			categories.find((c) => c.id === categoryId)?.name,
			...specs.filter((x) => x.value.trim()).map((x) => x.value.trim()).slice(0, 2),
			quantity > 1 ? `× ${quantity}` : '',
			note.trim() ? 'note' : '',
			lists.length && onLists.length ? `${onLists.length} ${onLists.length === 1 ? 'list' : 'lists'}` : ''
		]
			.filter(Boolean)
			.join(' · ')
	);

	$effect.pre(() => {
		const d = draft;
		if (d) untrack(() => seed(d));
	});

	function seed(d: Draft) {
		title = d.title ?? '';
		url = d.url ?? '';
		image = d.image_url ?? '';
		images = d.images?.length ? d.images : d.image_url ? [d.image_url] : [];
		price = centsToInput(d.price_cents);
		currency = d.currency ?? 'USD';
		store = d.store ?? '';
		categoryId = d.category_id ?? '';
		rating = d.rating ?? 0;
		quantity = d.quantity ?? 1;
		note = d.note ?? '';
		description = d.description ?? '';
		specs = (d.specifics ?? []).map((s) => ({ ...s }));
		error = null;
		showImageUrl = false;
		duplicate = null;
		allowDuplicate = false;
		more = false;
		onLists = d.id ? [...(d.lists ?? [])] : currentList ? [currentList] : [];
		if (!d.id) addSuggested(categoryId);
	}

	/** Fill an empty Size from the saved sizes, when the gift is clothing, shoes or a ring. */
	function fillSize() {
		const saved = sizeFor(categoryId, title, sizes);
		const row = specs.find((s) => s.label.toLowerCase() === 'size');
		if (saved && row && !row.value.trim()) row.value = saved;
	}

	/** The duplicate is already in Everything: just add it to the list being viewed. */
	async function putExistingHere() {
		if (!duplicate) return;
		const fd = new FormData();
		fd.set('id', duplicate.id);
		await fetch('?/addExisting', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		open = false;
		await invalidateAll();
	}

	function toggleList(id: string) {
		onLists = onLists.includes(id) ? onLists.filter((l) => l !== id) : [...onLists, id];
	}

	async function choosePhoto(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		error = null;
		try {
			const url = await uploadPhoto(file);
			image = url;
			images = [url, ...images.filter((i) => i !== url)];
		} catch (err) {
			error = (err as Error).message;
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	const category = $derived(categories.find((c) => c.id === categoryId));
	const missingSuggestions = $derived((category?.suggested_specs ?? []).filter((l) => !specs.some((s) => s.label.toLowerCase() === l.toLowerCase())));
	const isNew = $derived(!draft?.id);

	function addSuggested(id: string) {
		const c = categories.find((x) => x.id === id);
		for (const label of c?.suggested_specs ?? []) {
			if (!specs.some((s) => s.label.toLowerCase() === label.toLowerCase())) specs.push({ label, value: '' });
		}
	}

	function pickCategory(id: string) {
		// Drop empty rows from the previous category's suggestions before adding the new ones.
		specs = specs.filter((s) => s.value.trim());
		categoryId = id;
		addSuggested(id);
		fillSize();
	}
</script>

<Modal bind:open title={loading ? 'Fetching gift…' : isNew ? 'Add a gift' : 'Edit gift'} wide>
	<form
		id="item-form"
		method="POST"
		action="?/saveItem"
		bind:this={form}
		use:enhance={() => {
			saving = true;
			error = null;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					open = false;
					await update({ reset: false });
					onsaved?.(String(result.data?.saved ?? ''));
				} else if (result.type === 'failure' && result.data?.duplicate) {
					duplicate = result.data.duplicate as { id: string; title: string };
					showAttention();
				} else if (result.type === 'failure') {
					error = String(result.data?.error ?? 'Couldn’t save that.');
					showAttention();
				} else {
					await update();
				}
			};
		}}
	>
		<input type="hidden" name="id" value={draft?.id ?? ''} />
		<input type="hidden" name="image_url" value={image} />
		<input type="hidden" name="availability" value={draft?.availability ?? ''} />
		<input type="hidden" name="allow_duplicate" value={allowDuplicate ? '1' : ''} />
		{#each onLists as l (l)}<input type="hidden" name="in_list" value={l} />{/each}
		{#each Object.entries(extra) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}

		{#if loading}
			<!-- The three signature stripes, running while the shop's page is read. -->
			<div class="stripes-run -mt-5 mb-5 h-1.5 rounded-full sm:-mt-5" role="progressbar" aria-label="Fetching the gift’s details"></div>
		{/if}
		{#if notice && !loading}
			<div class="mb-5 flex gap-3 rounded-[var(--radius-control)] bg-rust-500/15 px-4 py-3 text-sm font-medium text-rust-300">
				<Icon name="alert" size={18} class="mt-px" /><span>{notice}</span>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
			<!-- Photo: swipe through what the shop had; the one showing is the one used. -->
			<div class="min-w-0 space-y-3">
				<div class="relative overflow-hidden rounded-[var(--radius-card)]">
					{#if images.length > 1 && !loading}
						<div class="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain" bind:this={strip} onscroll={onStripScroll} data-no-drag>
							{#each shown as src (src)}
								<div class="w-full shrink-0 snap-center snap-always"><ProductImage {src} alt={title} size={480} class="aspect-square w-full" /></div>
							{/each}
						</div>
						<span class="pointer-events-none absolute top-2.5 right-2.5 rounded-full bg-cocoa-950/80 px-2 py-0.5 text-xs font-bold tabular-nums">{shown.indexOf(image) + 1} / {shown.length}</span>
					{:else}
						<ProductImage src={image} alt={title} size={480} class="aspect-square w-full" />
					{/if}
					{#if loading}<div class="absolute inset-0 animate-pulse bg-cocoa-800"></div>{/if}
				</div>
				{#if images.length > 1 && !loading}
					<!-- The filmstrip: every picture small, the chosen one ringed. -->
					<div class="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-no-drag>
						{#each shown as src, k (src)}
							<button
								type="button"
								class="h-14 w-14 shrink-0 overflow-hidden rounded-[10px] ring-2 transition {src === image ? 'ring-mustard-400' : 'opacity-70 ring-transparent hover:opacity-100'}"
								onclick={() => showPhoto(k)}
								aria-label="Use picture {k + 1}"
								aria-pressed={src === image}
							>
								<ProductImage {src} size={56} class="h-full w-full" />
							</button>
						{/each}
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<label class="btn-ghost flex-1 cursor-pointer text-sm {uploading ? 'pointer-events-none opacity-60' : ''}">
						<Icon name="camera" size={18} />{uploading ? 'Uploading…' : 'Your own photo'}
						<input type="file" accept="image/*" class="sr-only" onchange={choosePhoto} />
					</label>
					{#if !showImageUrl}<button type="button" class="btn-quiet px-3 text-xs" onclick={() => (showImageUrl = true)}>Picture link</button>{/if}
				</div>
				{#if showImageUrl}<input class="field text-xs" placeholder="https://…/picture.jpg" bind:value={image} />{/if}
			</div>

			<!-- The essentials: what it is, what it costs, how much you want it. -->
			<div class="min-w-0 space-y-5">
				<label class="block">
					<span class="label">Gift</span>
					{#if loading}
						<div class="h-[4.5rem] animate-pulse rounded-xl bg-cocoa-800"></div>
					{:else}
						<textarea class="field min-h-[4.5rem] resize-none text-[15px] font-medium" name="title" required maxlength="200" placeholder="What is it?" bind:value={title} onblur={fillSize}></textarea>
					{/if}
				</label>

				<div>
					<label class="block">
						<span class="label">Price</span>
						<span class="field flex items-center gap-1 py-0 focus-within:ring-2 focus-within:ring-mustard-400">
							<span class="text-xl font-bold text-fg-faint">{symbol}</span>
							<input class="min-w-0 flex-1 bg-transparent py-2.5 text-2xl font-bold tabular-nums outline-none" name="price" inputmode="decimal" enterkeyhint="done" placeholder="0.00" bind:value={price} disabled={loading} />
						</span>
					</label>
					<!-- Currency: big chips to tap, not a menu. -->
					<input type="hidden" name="currency" value={currency} />
					<div class="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1" data-no-drag>
						{#each CURRENCIES as c (c)}
							<button type="button" class="chip min-h-9 shrink-0 px-3 text-xs {currency === c ? 'chip-on' : 'hover:text-fg'}" aria-pressed={currency === c} disabled={loading} onclick={() => (currency = c)}>{c}</button>
						{/each}
					</div>
				</div>

				<div>
					<span class="label">How much do you want it?</span>
					<Stars name="rating" bind:value={rating} size={26} />
				</div>

				<!-- Everything else, folded away until you want it. Still saved when folded. -->
				<div class="rounded-[var(--radius-card)] bg-cocoa-850">
					<button type="button" class="flex min-h-12 w-full items-center gap-3 px-4 text-left" aria-expanded={more} onclick={() => (more = !more)}>
						<span class="min-w-0 flex-1">
							<span class="block text-sm font-bold">More details</span>
							{#if summary && !more}<span class="block truncate text-xs text-fg-faint">{summary}</span>{/if}
						</span>
						<Icon name="chevron-down" size={18} class="shrink-0 text-fg-faint transition-transform duration-300 {more ? 'rotate-180' : ''}" />
					</button>
					<div class="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-soft)] {more ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}">
						<div class="min-h-0 overflow-hidden" inert={!more}>
							<div class="space-y-5 px-4 pt-1 pb-4">
								<div class="grid grid-cols-2 gap-3">
									<label class="block">
										<span class="label">Shop</span>
										<input class="field" name="store" maxlength="60" placeholder="Amazon, Etsy…" bind:value={store} disabled={loading} />
									</label>
									<label class="block">
										<span class="label">Quantity</span>
										<input class="field tabular-nums" type="number" name="quantity" min="1" max="99" bind:value={quantity} />
									</label>
								</div>

								<label class="block">
									<span class="label">Link</span>
									<input class="field text-fg-muted" name="url" type="url" placeholder="https://" bind:value={url} />
								</label>

								<div>
									<span class="label">Category</span>
									<input type="hidden" name="category_id" value={categoryId} />
									<div class="flex flex-wrap gap-1.5">
										{#each categories as c (c.id)}
											<button type="button" class="chip {categoryId === c.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={categoryId === c.id} onclick={() => pickCategory(categoryId === c.id ? '' : c.id)}>
												<Icon name={c.icon} size={15} />{c.name}
											</button>
										{/each}
									</div>
								</div>

								<!-- Specifics: size, colour, etc. -->
								<div>
									<div class="mb-2 flex items-baseline justify-between">
										<span class="label mb-0">Details</span>
										<span class="text-xs text-fg-faint">Size, colour, model…</span>
									</div>
									<div class="space-y-2">
										{#each specs as spec, i (i)}
											<div class="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] gap-2">
												<input class="field border-cocoa-800 bg-cocoa-800 py-2 text-xs font-bold text-fg-muted" name="spec_label" placeholder="Label" maxlength="40" bind:value={spec.label} />
												<input class="field py-2" name="spec_value" placeholder={spec.label === 'Size' ? 'e.g. 32W × 30L, M' : spec.label === 'Colour' ? 'e.g. Dark indigo' : 'Value'} maxlength="120" bind:value={spec.value} />
												<button type="button" class="btn-quiet px-2" aria-label="Remove {spec.label || 'detail'}" onclick={() => specs.splice(i, 1)}>
													<Icon name="close" size={16} />
												</button>
											</div>
										{/each}
									</div>
									{#if sizeChips.length}
										<!-- Your saved sizes, one tap to use. -->
										<div class="mt-2 flex flex-wrap items-center gap-1.5">
											<span class="text-xs font-bold text-fg-faint">Your sizes:</span>
											{#each sizeChips as sc (sc.key)}
												<button type="button" class="chip min-h-8 px-2.5 text-xs {sizeValue === sc.value ? 'chip-on' : 'hover:text-fg'}" onclick={() => useSize(sc.value)}>{sc.label} {sc.value}</button>
											{/each}
										</div>
									{/if}
									<div class="mt-3 flex flex-wrap gap-1.5">
										{#each missingSuggestions as label (label)}
											<button type="button" class="chip hover:text-fg" onclick={() => specs.push({ label, value: '' })}>+ {label}</button>
										{/each}
										<button type="button" class="chip bg-transparent ring-2 ring-cocoa-700 ring-inset hover:text-fg" onclick={() => specs.push({ label: '', value: '' })}>+ Add detail</button>
									</div>
								</div>

								{#if lists.length}
									<div>
										<span class="label">On these lists <span class="normal-case text-fg-faint">(it’s always in Everything)</span></span>
										<div class="flex flex-wrap gap-1.5">
											{#each lists as l (l.id)}
												<button type="button" class="chip {onLists.includes(l.id) ? 'chip-on' : 'hover:text-fg'}" aria-pressed={onLists.includes(l.id)} onclick={() => toggleList(l.id)}>
													<Icon name={onLists.includes(l.id) ? 'check' : occasionMeta(l.occasion).icon} size={15} />{l.name}
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<label class="block">
									<span class="label">Note for the giver</span>
									<input class="field" name="note" maxlength="500" placeholder="Any colour but red · the 2nd edition, please" bind:value={note} />
								</label>

								<label class="block">
									<span class="label">Description</span>
									<textarea class="field min-h-20 text-xs text-fg-muted" name="description" maxlength="1000" bind:value={description}></textarea>
								</label>
							</div>
						</div>
					</div>
				</div>

				{#if duplicate}
					<div class="rounded-[var(--radius-control)] bg-mustard-400/15 p-4 text-sm" data-attention>
						<p class="flex gap-2 font-bold text-mustard-300"><Icon name="alert" size={18} />You already have this one</p>
						<p class="mt-1 text-fg-muted">“{duplicate.title}” is already on your wish list.</p>
						<div class="mt-3 flex flex-wrap gap-2">
							{#if currentList}
								<button type="button" class="btn-primary text-sm" onclick={putExistingHere}>Put that one on this list</button>
							{/if}
							<button type="button" class="btn-ghost text-sm" onclick={() => { allowDuplicate = true; duplicate = null; queueMicrotask(() => form?.requestSubmit()); }}>Add it again anyway</button>
						</div>
					</div>
				{/if}
				{#if error}<p class="text-sm font-bold text-rust-300" data-attention>{error}</p>{/if}
			</div>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex items-center justify-between gap-2">
			<div>
				{#if !isNew}
					<!-- No "are you sure?": it goes at once, and the strip at the bottom offers Undo. -->
					<div class="flex flex-wrap gap-1">
						{#if currentList}<button type="button" class="btn-quiet hover:text-rust-300" onclick={() => drop('list')}>Remove from list</button>{/if}
						<button type="button" class="btn-quiet hover:text-rust-300" onclick={() => drop('everywhere')}>{currentList ? 'Delete everywhere' : 'Delete'}</button>
					</div>
				{:else}
					<!-- Changing your mind about a new gift: one clear way out. -->
					<button type="button" class="btn-quiet hover:text-rust-300" onclick={() => (open = false)}><Icon name="close" size={18} />Don’t add</button>
				{/if}
			</div>
			<div class="flex gap-2">
				{#if !isNew}<button type="button" class="btn-quiet" onclick={() => (open = false)}>Cancel</button>{/if}
				<button form="item-form" class="btn-primary" disabled={saving || loading}>{saving ? 'Saving…' : isNew ? (saveLabel ?? 'Add gift') : 'Save'}</button>
			</div>
		</div>
	{/snippet}
</Modal>
