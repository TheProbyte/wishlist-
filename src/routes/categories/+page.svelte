<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '#lib/components/Modal.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { CATEGORY_ICONS } from '#lib/icons.ts';
	import type { Category } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The palette's text-safe tones: mustard, rust, teal, cream, and a quiet tan.
	const COLORS = [
		{ value: '#E8A83A', name: 'Mustard' },
		{ value: '#EC9468', name: 'Rust' },
		{ value: '#7CC2BA', name: 'Teal' },
		{ value: '#F3E7CF', name: 'Cream' },
		{ value: '#C9B79A', name: 'Tan' }
	];

	let open = $state(false);
	let editing = $state<Partial<Category>>({});
	let icon = $state('gift');
	let color = $state(COLORS[0].value);

	function start(c?: Category) {
		editing = c ?? {};
		icon = c?.icon ?? 'gift';
		color = c?.color ?? COLORS[0].value;
		open = true;
	}

	const builtIn = $derived(data.categories.filter((c) => !c.owner_id));
	const mine = $derived(data.categories.filter((c) => c.owner_id));
</script>

<svelte:head><title>Categories · The Giver</title></svelte:head>

<section class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<h1 class="display text-[40px] leading-[1.05]">Categories</h1>
		<p class="mt-3 max-w-lg text-fg-muted">Each category asks for the details that matter, like size and colour for clothes. New gifts land in one automatically when the name makes it obvious.</p>
	</div>
	<button class="btn-primary self-start" onclick={() => start()}><Icon name="plus" size={18} />New category</button>
</section>

{#snippet row(c: (typeof data.categories)[number], editable: boolean)}
	<div class="card flex items-center gap-4 px-4 py-3.5">
		<span class="grid h-12 w-12 shrink-0 -rotate-3 place-items-center rounded-full bg-cocoa-950 shadow-[0_2px_0_0_var(--color-edge)]" style="color: {c.color}"><Icon name={c.icon} size={24} /></span>
		<div class="min-w-0 flex-1">
			<div class="flex items-baseline gap-2">
				<span class="font-bold">{c.name}</span>
				<span class="text-xs font-bold text-fg-faint">{c.count} {c.count === 1 ? 'gift' : 'gifts'}</span>
			</div>
			<div class="mt-1 flex flex-wrap gap-1">
				{#each c.suggested_specs as s (s)}<span class="pill">{s}</span>{:else}<span class="text-xs text-fg-faint">No suggested details</span>{/each}
			</div>
		</div>
		{#if editable}
			<button class="btn-quiet text-sm" onclick={() => start(c)}>Edit</button>
		{/if}
	</div>
{/snippet}

{#if mine.length}
	<h2 class="mb-3 text-xs font-bold tracking-wider text-fg-faint uppercase">Yours</h2>
	<div class="mb-10 grid gap-3 md:grid-cols-2">
		{#each mine as c (c.id)}{@render row(c, true)}{/each}
	</div>
{/if}
<h2 class="mb-3 text-xs font-bold tracking-wider text-fg-faint uppercase">Built in</h2>
<div class="grid gap-3 md:grid-cols-2">
	{#each builtIn as c (c.id)}{@render row(c, false)}{/each}
</div>

<Modal bind:open title={editing.id ? 'Edit category' : 'New category'}>
	<form
		id="cat-form"
		method="POST"
		action="?/save"
		class="space-y-6"
		use:enhance={() => async ({ result, update }) => {
			await update();
			if (result.type === 'success') open = false;
		}}
	>
		<input type="hidden" name="id" value={editing.id ?? ''} />
		<input type="hidden" name="icon" value={icon} />
		<input type="hidden" name="color" value={color} />
		<label class="block">
			<span class="label">Name</span>
			<input class="field" name="name" required maxlength="40" value={editing.name ?? ''} placeholder="e.g. Camping gear" />
		</label>
		<div>
			<span class="label">Icon</span>
			<div class="grid grid-cols-6 gap-2 sm:grid-cols-8">
				{#each CATEGORY_ICONS as i (i)}
					<button type="button" aria-label={i} aria-pressed={icon === i} class="grid aspect-square place-items-center rounded-[12px] transition {icon === i ? 'bg-mustard-400 text-cocoa-950' : 'bg-cocoa-800 text-fg-muted hover:text-fg'}" onclick={() => (icon = i)}>
						<Icon name={i} size={22} />
					</button>
				{/each}
			</div>
		</div>
		<div>
			<span class="label">Colour</span>
			<div class="flex flex-wrap gap-3">
				{#each COLORS as c (c.value)}
					<button type="button" aria-label={c.name} aria-pressed={color === c.value} class="h-11 w-11 rounded-full transition {color === c.value ? 'ring-3 ring-fg ring-offset-3 ring-offset-cocoa-900' : 'hover:scale-110'}" style="background: {c.value}" onclick={() => (color = c.value)}></button>
				{/each}
			</div>
		</div>
		<label class="block">
			<span class="label">Details to ask for</span>
			<input class="field" name="specs" maxlength="300" value={(editing.suggested_specs ?? []).join(', ')} placeholder="Size, Colour, Material" />
			<span class="mt-1.5 block text-xs text-fg-faint">Comma separated. These show up as fields when you add a gift in this category.</span>
		</label>
		{#if form?.error}<p class="text-sm font-bold text-rust-300">{form.error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex items-center justify-between">
			<div>
				{#if editing.id}
					<form method="POST" action="?/delete" use:enhance={() => async ({ update }) => { await update(); open = false; }}>
						<input type="hidden" name="id" value={editing.id} />
						<button class="btn-quiet hover:text-rust-300">Delete</button>
					</form>
				{/if}
			</div>
			<div class="flex gap-2">
				<button type="button" class="btn-quiet" onclick={() => (open = false)}>Cancel</button>
				<button form="cat-form" class="btn-primary">Save</button>
			</div>
		</div>
	{/snippet}
</Modal>
