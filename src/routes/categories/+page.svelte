<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '#lib/components/Modal.svelte';
	import type { Category } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const COLORS = ['#f472b6', '#fb923c', '#facc15', '#34d399', '#2dd4bf', '#60a5fa', '#a78bfa', '#f87171', '#a1a1aa'];
	const ICONS = ['🎁', '👕', '👟', '🎧', '📚', '🛋️', '💄', '🎮', '💍', '🎟️', '🍳', '🌿', '🧸', '🏕️', '🎨', '🐶', '⚽', '🍷', '✈️', '💻'];

	let open = $state(false);
	let editing = $state<Partial<Category>>({});
	let icon = $state('🎁');
	let color = $state(COLORS[0]);

	function start(c?: Category) {
		editing = c ?? {};
		icon = c?.icon ?? '🎁';
		color = c?.color ?? COLORS[0];
		open = true;
	}

	const builtIn = $derived(data.categories.filter((c) => !c.owner_id));
	const mine = $derived(data.categories.filter((c) => c.owner_id));
</script>

<svelte:head><title>Categories · The Giver</title></svelte:head>

<section class="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<h1 class="font-display text-4xl font-semibold tracking-tight">Categories</h1>
		<p class="mt-2 max-w-lg text-fg-muted">Each category suggests the details worth noting, like size and colour for clothes. New gifts are sorted into one automatically when the name makes it obvious.</p>
	</div>
	<button class="btn-primary self-start" onclick={() => start()}>New category</button>
</section>

{#snippet row(c: (typeof data.categories)[number], editable: boolean)}
	<div class="card flex items-center gap-4 px-4 py-3.5">
		<span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl" style="background: {c.color}1f; box-shadow: inset 0 0 0 1px {c.color}40">{c.icon}</span>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="font-medium">{c.name}</span>
				<span class="text-xs text-fg-faint">{c.count} {c.count === 1 ? 'gift' : 'gifts'}</span>
			</div>
			<div class="mt-1 flex flex-wrap gap-1">
				{#each c.suggested_specs as s (s)}<span class="pill">{s}</span>{:else}<span class="text-xs text-fg-faint">No suggested details</span>{/each}
			</div>
		</div>
		{#if editable}
			<button class="btn-quiet text-xs" onclick={() => start(c)}>Edit</button>
		{/if}
	</div>
{/snippet}

{#if mine.length}
	<h2 class="mb-3 text-xs font-medium tracking-wide text-fg-faint uppercase">Yours</h2>
	<div class="mb-10 grid gap-3 md:grid-cols-2">
		{#each mine as c (c.id)}{@render row(c, true)}{/each}
	</div>
{/if}
<h2 class="mb-3 text-xs font-medium tracking-wide text-fg-faint uppercase">Built in</h2>
<div class="grid gap-3 md:grid-cols-2">
	{#each builtIn as c (c.id)}{@render row(c, false)}{/each}
</div>

<Modal bind:open title={editing.id ? 'Edit category' : 'New category'}>
	<form
		id="cat-form"
		method="POST"
		action="?/save"
		class="space-y-5"
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
			<div class="flex flex-wrap gap-1.5">
				{#each ICONS as i (i)}
					<button type="button" class="grid h-9 w-9 place-items-center rounded-lg text-lg transition {icon === i ? 'bg-ink-600 ring-2 ring-gold-400' : 'bg-ink-800 hover:bg-ink-700'}" onclick={() => (icon = i)}>{i}</button>
				{/each}
			</div>
		</div>
		<div>
			<span class="label">Colour</span>
			<div class="flex flex-wrap gap-2">
				{#each COLORS as c (c)}
					<button type="button" aria-label="Colour {c}" class="h-8 w-8 rounded-full transition {color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-900' : 'hover:scale-110'}" style="background: {c}" onclick={() => (color = c)}></button>
				{/each}
			</div>
		</div>
		<label class="block">
			<span class="label">Details to ask for</span>
			<input class="field" name="specs" maxlength="300" value={(editing.suggested_specs ?? []).join(', ')} placeholder="Size, Colour, Material" />
			<span class="mt-1.5 block text-xs text-fg-faint">Comma separated. These appear as fields when you add a gift in this category.</span>
		</label>
		{#if form?.error}<p class="text-sm text-red-300">{form.error}</p>{/if}
	</form>
	{#snippet footer()}
		<div class="flex items-center justify-between">
			<div>
				{#if editing.id}
					<form method="POST" action="?/delete" use:enhance={() => async ({ update }) => { await update(); open = false; }}>
						<input type="hidden" name="id" value={editing.id} />
						<button class="btn-quiet hover:text-red-300">Delete</button>
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
