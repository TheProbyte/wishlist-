<script lang="ts">
	import { paperFor } from '#lib/papers.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SizesCard from '#lib/components/SizesCard.svelte';
	import { countdownLabel, occasionDate } from '#lib/format.ts';
	import type { TabForm } from './types.ts';
	import type { MeData } from '#lib/server/tabs/me.ts';

	/** One of the three tabs; the shell around it is in routes/[[tab=tab]]. */
	let { data, form, me = null }: { data: MeData; form: TabForm; me?: { id: string; name: string } | null } = $props();

	const hasSizes = $derived(Object.values(data.profile.sizes).some(Boolean));
</script>

<section class="mb-8 flex items-center gap-4">
	<Avatar name={data.profile.name === 'You' ? 'Y' : data.profile.name} src={data.profile.avatar_url} sticker={data.profile.sticker} size={64} />
	<div class="min-w-0">
		<h1 class="display accent-bar truncate text-[36px] leading-tight">{data.profile.name === 'You' ? 'You' : data.profile.name}</h1>
		{#if data.profile.email}<p class="truncate text-sm text-fg-muted">{data.profile.email}</p>{/if}
	</div>
</section>

{#if !data.authEnabled}
	<div class="mb-8 flex gap-3 rounded-[var(--radius-card)] bg-mustard-400/15 px-4 py-3 text-sm text-mustard-300">
		<Icon name="alert" size={20} />
		<span><span class="font-bold">Google sign-in isn’t switched on yet.</span> Until it is, the app has one shared account and people can’t join your circles. The README explains the two keys to add in Cloudflare.</span>
	</div>
{/if}

<!-- Everything about you, each in its own place: tap a card to open it. -->
<div class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
	<a href="/me/about" class="card rise block min-w-0 p-4 transition active:translate-y-0.5 sm:col-span-2" style="--i: 0">
		<span class="flex items-center gap-3">
			<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cocoa-950 text-rust-300"><Icon name="cake" size={22} /></span>
			<span class="min-w-0 flex-1"><span class="block font-bold">About you</span><span class="block truncate text-sm text-fg-muted">{data.profile.birthday ? `Birthday ${countdownLabel(occasionDate('birthday', data.profile.birthday))}` : 'Add your birthday'} · {hasSizes ? 'sizes saved' : 'add your sizes'}</span></span>
			<Icon name="chevron-right" size={18} class="shrink-0" />
		</span>
		{#if hasSizes}<SizesCard sizes={data.profile.sizes} row class="mt-3" />{/if}
	</a>
	<a href="/me/family" class="card rise flex items-center gap-3 p-4 transition active:translate-y-0.5" style="--i: 1">
		{#if data.kids.length}
			<span class="flex shrink-0 -space-x-3">{#each data.kids.slice(0, 3) as k (k.id)}<span class="rounded-full ring-3 ring-cocoa-850"><Avatar name={k.name} size={40} /></span>{/each}</span>
		{:else}
			<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cocoa-950 text-teal-300"><Icon name="teddy" size={22} /></span>
		{/if}
		<span class="min-w-0 flex-1"><span class="block font-bold">Family</span><span class="block truncate text-sm text-fg-muted">{data.kids.length ? data.kids.map((k) => k.name).join(', ') : 'Wish lists for your kids'}</span></span>
		<Icon name="chevron-right" size={18} class="shrink-0" />
	</a>
	<a href="/me/look" class="card rise flex items-center gap-3 p-4 transition active:translate-y-0.5" style="--i: 2">
		<span class="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full" style="background: {paperFor(data.profile.paper ?? 'sunburst').background}">
			<span class="grid h-7 w-7 place-items-center rounded-full bg-cocoa-950/85 text-mustard-400"><Icon name="palette" size={16} /></span>
		</span>
		<span class="min-w-0 flex-1"><span class="block font-bold">Look &amp; feel</span><span class="block truncate text-sm text-fg-muted">Sticker, paper, the app’s colours</span></span>
		<Icon name="chevron-right" size={18} class="shrink-0" />
	</a>
	<a href="/me/tools" class="card rise flex items-center gap-3 p-4 transition active:translate-y-0.5" style="--i: 3">
		<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cocoa-950 text-teal-300"><Icon name="share" size={20} /></span>
		<span class="min-w-0 flex-1"><span class="block font-bold">Add from anywhere</span><span class="block truncate text-sm text-fg-muted">Share menu, bookmark button, Amazon lists</span></span>
		<Icon name="chevron-right" size={18} class="shrink-0" />
	</a>
	<a href="/categories" class="card rise flex items-center gap-3 p-4 transition active:translate-y-0.5" style="--i: 4">
		<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cocoa-950 text-mustard-400"><Icon name="tag" size={22} /></span>
		<span class="min-w-0 flex-1"><span class="block font-bold">Categories</span><span class="block truncate text-sm text-fg-muted">Your own, with the details to ask for</span></span>
		<Icon name="chevron-right" size={18} class="shrink-0" />
	</a>
</div>

{#if data.authEnabled}
	<form method="POST" action="/auth/logout">
		<button class="btn-quiet w-full justify-center text-rust-300">Sign out</button>
		<p class="mt-1 text-center text-xs text-fg-faint">Claims on your lists stay hidden on this device even after you sign out.</p>
	</form>
{/if}
