<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import SizeFields from '#lib/components/SizeFields.svelte';
	import SizesCard from '#lib/components/SizesCard.svelte';
	import { countdownLabel, occasionDate } from '#lib/format.ts';
	import { shell } from '#lib/shell.svelte.ts';
	import type { Kid } from '#lib/types.ts';
	import type { PageProps } from './$types';

	/** Family: the kids you keep wish lists for, their birthdays and sizes. */
	let { data, form }: PageProps = $props();

	let editing = $state<Kid | null>(null);
	let open = $state(false);
	let confirmRemove = $state(false);
	function edit(kid: Kid) {
		editing = kid;
		confirmRemove = false;
		open = true;
	}
	async function addKid() {
		shell.request = 'new-kid';
		await goto('/');
	}
</script>

<svelte:head><title>Family · The Giver</title></svelte:head>

<a href="/me" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />You</a>
<h1 class="display accent-bar mb-2 text-[34px] leading-tight">Family</h1>
<p class="mb-6 max-w-lg text-fg-muted">Keep wish lists for your kids: you pick what goes on them, and they’re clearly labelled with their names when you share them.</p>

<div class="mb-6 grid gap-3 sm:grid-cols-2">
	{#each data.kids as kid, i (kid.id)}
		{@const bday = kid.birthday ? occasionDate('birthday', kid.birthday) : null}
		<div class="card rise p-4" style="--i: {i}">
			<div class="flex items-center gap-3">
				<Avatar name={kid.name} size={48} />
				<div class="min-w-0 flex-1">
					<p class="display truncate text-xl">{kid.name}</p>
					<p class="text-xs font-bold text-fg-faint">{bday ? `Birthday ${countdownLabel(bday)}` : 'No birthday saved'}</p>
				</div>
				<a href="/lists/mst_{kid.id}" class="btn-quiet px-3 text-sm">Lists</a>
				<button class="btn-ghost px-3 text-sm" onclick={() => edit(kid)}>Edit</button>
			</div>
			{#if Object.values(kid.sizes).some(Boolean)}<SizesCard sizes={kid.sizes} row class="mt-3" />{/if}
		</div>
	{/each}
</div>

<button class="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 py-6 text-sm font-bold text-fg-muted transition hover:border-mustard-400 hover:text-mustard-400" onclick={addKid}>
	<Icon name="plus" size={18} />Add a kid’s wish list
</button>

<Modal bind:open title="Edit {editing?.name ?? ''}">
	{#if editing}
		<form
			id="kid-form"
			method="POST"
			action="?/saveKid"
			class="space-y-5"
			use:enhance={() => async ({ update, result }) => {
				await update({ reset: false });
				if (result.type === 'success') open = false;
			}}
		>
			<input type="hidden" name="id" value={editing.id} />
			<label class="block"><span class="label">Name</span><input class="field" name="name" required maxlength="40" value={editing.name} /></label>
			<label class="block"><span class="label">Birthday</span><input class="field sm:max-w-56" type="date" name="birthday" value={editing.birthday ?? ''} /></label>
			<div>
				<span class="label">Sizes</span>
				<SizeFields sizes={editing.sizes} />
			</div>
			{#if form?.kidError}<p class="text-sm font-bold text-rust-300">{form.kidError}</p>{/if}
		</form>
		<div class="mt-8 rounded-[var(--radius-card)] bg-rust-500/10 p-4">
			<form method="POST" action="?/deleteKid" use:enhance={() => async ({ update }) => { await update(); open = false; }} class="flex items-center justify-between gap-4">
				<input type="hidden" name="id" value={editing.id} />
				<p class="text-sm text-fg-muted">Remove {editing.name} and all their lists and gifts.</p>
				{#if confirmRemove}
					<button class="btn-danger shrink-0">Yes, remove</button>
				{:else}
					<button type="button" class="btn-quiet shrink-0 text-rust-300" onclick={() => (confirmRemove = true)}>Remove</button>
				{/if}
			</form>
		</div>
	{/if}
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (open = false)}>Cancel</button>
			<button form="kid-form" class="btn-primary">Save</button>
		</div>
	{/snippet}
</Modal>
