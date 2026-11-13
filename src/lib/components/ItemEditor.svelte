<script lang="ts" module>
	import type { Item, Specific } from '#lib/types.ts';
	export type Draft = Partial<Omit<Item, 'specifics'>> & { specifics?: Specific[]; images?: string[] };
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Modal from './Modal.svelte';
	import Stars from './Stars.svelte';
	import ProductImage from './ProductImage.svelte';
	import Icon from './Icon.svelte';
	import { CURRENCIES, centsToInput } from '#lib/format.ts';
	import type { Category } from '#lib/types.ts';

	let {
		open = $bindable(false),
		draft,
		loading = false,
		notice = null,
		categories,
		onsaved
	}: {
		open?: boolean;
		draft: Draft | null;
		loading?: boolean;
		notice?: string | null;
		categories: Category[];
		onsaved?: (id: string) => void;
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
	let saving = $state(false);
	let confirmDelete = $state(false);
	let showImageUrl = $state(false);

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
		confirmDelete = false;
		showImageUrl = false;
		if (!d.id) addSuggested(categoryId);
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
	}
</script>

<Modal bind:open title={loading ? 'Fetching gift…' : isNew ? 'Add a gift' : 'Edit gift'} wide>
	<form
		id="item-form"
		method="POST"
		action="?/saveItem"
		use:enhance={() => {
			saving = true;
			error = null;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					open = false;
					await update({ reset: false });
					onsaved?.(String(result.data?.saved ?? ''));
				} else if (result.type === 'failure') {
					error = String(result.data?.error ?? 'Couldn’t save that.');
				} else {
					await update();
				}
			};
		}}
	>
		<input type="hidden" name="id" value={draft?.id ?? ''} />
		<input type="hidden" name="image_url" value={image} />
		<input type="hidden" name="availability" value={draft?.availability ?? ''} />

		{#if notice && !loading}
			<div class="mb-5 flex gap-3 rounded-[var(--radius-control)] bg-rust-500/15 px-4 py-3 text-sm font-medium text-rust-300">
				<Icon name="alert" size={18} class="mt-px" /><span>{notice}</span>
			</div>
		{/if}

		<div class="grid gap-6 md:grid-cols-[15rem_1fr]">
			<!-- Image -->
			<div class="space-y-3">
				<div class="relative overflow-hidden rounded-[var(--radius-card)]">
					<ProductImage src={image} alt={title} class="aspect-square w-full" />
					{#if loading}<div class="absolute inset-0 animate-pulse bg-cocoa-800"></div>{/if}
				</div>
				{#if images.length > 1}
					<div class="grid grid-cols-4 gap-2">
						{#each images.slice(0, 8) as src (src)}
							<button
								type="button"
								class="overflow-hidden rounded-lg ring-2 transition {src === image ? 'ring-mustard-400' : 'ring-transparent hover:ring-cocoa-500'}"
								onclick={() => (image = src)}
								aria-label="Use this picture"
							>
								<ProductImage {src} class="aspect-square w-full" />
							</button>
						{/each}
					</div>
				{/if}
				{#if showImageUrl}
					<input class="field text-xs" placeholder="https://…/picture.jpg" bind:value={image} />
				{:else}
					<button type="button" class="text-xs text-fg-faint hover:text-mustard-300" onclick={() => (showImageUrl = true)}>Use a different picture link</button>
				{/if}
			</div>

			<!-- Fields -->
			<div class="space-y-5">
				<label class="block">
					<span class="label">Gift</span>
					{#if loading}
						<div class="h-[4.5rem] animate-pulse rounded-xl bg-cocoa-800"></div>
					{:else}
						<textarea class="field min-h-[4.5rem] resize-none text-[15px] font-medium" name="title" required maxlength="200" placeholder="What is it?" bind:value={title}></textarea>
					{/if}
				</label>

				<div class="grid grid-cols-[1fr_6.5rem] gap-3 sm:grid-cols-[1fr_6.5rem_1fr]">
					<label class="block">
						<span class="label">Price</span>
						<input class="field tabular-nums" name="price" inputmode="decimal" placeholder="0.00" bind:value={price} disabled={loading} />
					</label>
					<label class="block">
						<span class="label">Currency</span>
						<select class="field" name="currency" bind:value={currency} disabled={loading}>
							{#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
						</select>
					</label>
					<label class="col-span-2 block sm:col-span-1">
						<span class="label">Shop</span>
						<input class="field" name="store" maxlength="60" placeholder="Amazon, Etsy…" bind:value={store} disabled={loading} />
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
							<button
								type="button"
								class="chip {categoryId === c.id ? 'chip-on' : 'hover:text-fg'}"
								aria-pressed={categoryId === c.id}
								onclick={() => pickCategory(categoryId === c.id ? '' : c.id)}
							>
								<Icon name={c.icon} size={15} />{c.name}
							</button>
						{/each}
					</div>
				</div>

				<!-- Specifics: size, colour, etc. -->
				<div class="rounded-[var(--radius-card)] bg-cocoa-850 p-4">
					<div class="mb-3 flex items-center justify-between">
						<span class="text-sm font-medium">Details</span>
						<span class="text-xs text-fg-faint">Size, colour, model… whatever matters</span>
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
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each missingSuggestions as label (label)}
							<button type="button" class="chip hover:text-fg" onclick={() => specs.push({ label, value: '' })}>+ {label}</button>
						{/each}
						<button type="button" class="chip bg-transparent ring-2 ring-cocoa-700 ring-inset hover:text-fg" onclick={() => specs.push({ label: '', value: '' })}>+ Add detail</button>
					</div>
				</div>

				<div class="grid grid-cols-[1fr_auto] items-end gap-4">
					<div>
						<span class="label">How much do you want it?</span>
						<Stars name="rating" bind:value={rating} size={22} />
					</div>
					<label class="block w-24">
						<span class="label">Quantity</span>
						<input class="field tabular-nums" type="number" name="quantity" min="1" max="99" bind:value={quantity} />
					</label>
				</div>

				<label class="block">
					<span class="label">Note for the giver</span>
					<input class="field" name="note" maxlength="500" placeholder="Any colour but red · the 2nd edition, please" bind:value={note} />
				</label>

				<details class="group">
					<summary class="cursor-pointer list-none text-xs text-fg-faint hover:text-fg-muted">
						<span class="group-open:hidden">+ Description</span><span class="hidden group-open:inline">− Description</span>
					</summary>
					<textarea class="field mt-2 min-h-24 text-xs text-fg-muted" name="description" maxlength="1000" bind:value={description}></textarea>
				</details>

				{#if error}<p class="text-sm font-bold text-rust-300">{error}</p>{/if}
			</div>
		</div>
	</form>

	{#snippet footer()}
		<div class="flex items-center justify-between gap-2">
			<div>
				{#if !isNew}
					<form method="POST" action="?/deleteItem" use:enhance={() => async ({ update }) => { open = false; await update(); }}>
						<input type="hidden" name="id" value={draft?.id} />
						{#if confirmDelete}
							<button class="btn-danger">Delete for good</button>
							<button type="button" class="btn-quiet" onclick={() => (confirmDelete = false)}>Keep</button>
						{:else}
							<button type="button" class="btn-quiet hover:text-rust-300" onclick={() => (confirmDelete = true)}>Delete</button>
						{/if}
					</form>
				{/if}
			</div>
			<div class="flex gap-2">
				<button type="button" class="btn-quiet" onclick={() => (open = false)}>Cancel</button>
				<button form="item-form" class="btn-primary" disabled={saving || loading}>{saving ? 'Saving…' : isNew ? 'Add to list' : 'Save'}</button>
			</div>
		</div>
	{/snippet}
</Modal>
