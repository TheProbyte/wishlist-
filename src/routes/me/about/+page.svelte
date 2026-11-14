<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import SizeFields from '#lib/components/SizeFields.svelte';
	import SizesCard from '#lib/components/SizesCard.svelte';
	import { toast } from '#lib/undo.svelte.ts';
	import type { PageProps } from './$types';

	/** About you: your birthday and your sizes, and how givers see your sizes. */
	let { data }: PageProps = $props();
</script>

<svelte:head><title>About you · The Giver</title></svelte:head>

<a href="/me" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />You</a>
<h1 class="display accent-bar mb-2 text-[34px] leading-tight">About you</h1>
<p class="mb-6 max-w-lg text-fg-muted">Your sizes fill in by themselves when you add clothes, and givers can see them. You can always change the size on a single gift.</p>

<form
	method="POST"
	action="?/saveProfile"
	class="card mb-8 space-y-5 p-5"
	use:enhance={() => async ({ update, result }) => {
		await update({ reset: false });
		if (result.type === 'success') toast('Saved');
	}}
>
	<label class="block">
		<span class="label">Your birthday</span>
		<input class="field sm:max-w-56" type="date" name="birthday" value={data.profile.birthday ?? ''} />
		<span class="mt-1.5 block text-xs text-fg-faint">Shown to people in your circles so they know it’s coming up.</span>
	</label>
	<SizeFields sizes={data.profile.sizes} />
	<div class="flex justify-end"><button class="btn-primary">Save</button></div>
</form>

<section class="mb-8">
	<h2 class="mb-1 text-lg font-bold">What givers see</h2>
	<p class="mb-3 text-sm text-fg-muted">Your sizes, as the labels sewn into clothes, at the top of your wish list.</p>
	{#if Object.values(data.profile.sizes).some(Boolean)}
		<SizesCard sizes={data.profile.sizes} />
	{:else}
		<p class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 p-5 text-center text-sm text-fg-faint">No sizes saved yet. Add some above and they show up here.</p>
	{/if}
</section>
