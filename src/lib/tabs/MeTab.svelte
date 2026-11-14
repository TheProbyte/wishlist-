<script lang="ts">
	import PaperPicker from '#lib/components/PaperPicker.svelte';
	import { STICKER_ICONS, STICKER_INKS, makeSticker, readSticker } from '#lib/stickers.ts';
	import { INKS, INK_NAMES, type Ink } from '#lib/papers.ts';
	import { getPref, setPref } from '#lib/prefs.ts';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SizeFields from '#lib/components/SizeFields.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { bookmarklet } from '#lib/bookmarklet.ts';
	import type { TabForm } from './types.ts';
	import type { Kid } from '#lib/types.ts';
	import type { MeData } from '#lib/server/tabs/me.ts';

	/** One of the three tabs; the shell around it is in routes/[[tab=tab]]. */
	let { data, form, me = null }: { data: MeData; form: TabForm; me?: { id: string; name: string } | null } = $props();

	let savedNote = $state<string | null>(null);
	const flash = (msg: string) => {
		savedNote = msg;
		setTimeout(() => (savedNote = null), 2200);
	};

	let editingKid = $state<Kid | null>(null);
	let kidOpen = $state(false);
	let confirmRemove = $state(false);

	const code = $derived(bookmarklet(page.url.origin));
	let copiedCode = $state(false);
	async function copyCode() {
		await navigator.clipboard.writeText(code);
		copiedCode = true;
		setTimeout(() => (copiedCode = false), 1800);
	}

	// Your look.
	// svelte-ignore state_referenced_locally
	const startSticker = readSticker(data.profile.sticker);
	let useSticker = $state(!!startSticker);
	let stickerIcon = $state<string>(startSticker?.icon ?? 'gift');
	let stickerInk = $state<Ink>(startSticker?.ink ?? 'mustard');
	// svelte-ignore state_referenced_locally
	let myPaper = $state(data.profile.paper ?? 'sunburst');
	let lookBusy = $state(false);
	let lookSaved = $state(false);

	// The paper pointer, remembered on this computer.
	let paperPointer = $state(false);
	$effect(() => {
		paperPointer = getPref('pointer') !== 'normal';
	});
</script>

<section class="mb-8 flex items-center gap-4">
	<Avatar name={data.profile.name === 'You' ? 'Y' : data.profile.name} src={data.profile.avatar_url} sticker={data.profile.sticker} size={64} />
	<div class="min-w-0">
		<h1 class="display accent-bar truncate text-[36px] leading-tight">{data.profile.name === 'You' ? 'You' : data.profile.name}</h1>
		{#if data.profile.email}<p class="truncate text-sm text-fg-muted">{data.profile.email}</p>{/if}
	</div>
</section>

<!-- Your look: a sticker instead of your photo, and your signature paper. -->
<form
	method="POST"
	action="?/saveLook"
	class="card mb-8 p-4 sm:p-5"
	use:enhance={() => {
		lookBusy = true;
		return async ({ update }) => {
			await update({ reset: false });
			lookBusy = false;
			lookSaved = true;
			setTimeout(() => (lookSaved = false), 1800);
		};
	}}
>
	<h2 class="text-lg font-bold">Your look</h2>
	<p class="mt-0.5 text-sm text-fg-muted">How you show up to your people: on your tag, your share links, and the paper your gifts get wrapped in.</p>
	<input type="hidden" name="sticker" value={useSticker ? makeSticker(stickerIcon, stickerInk) : ''} />

	<div class="mt-4 flex items-center gap-4">
		<Avatar name={data.profile.name} src={data.profile.avatar_url} sticker={useSticker ? makeSticker(stickerIcon, stickerInk) : null} size={64} />
		<div class="flex gap-1.5 rounded-full bg-cocoa-950 p-1 text-sm font-bold">
			<button type="button" class="rounded-full px-3 py-1.5 {useSticker ? 'bg-cocoa-800 text-fg' : 'text-fg-faint'}" aria-pressed={useSticker} onclick={() => (useSticker = true)}>Sticker</button>
			<button type="button" class="rounded-full px-3 py-1.5 {!useSticker ? 'bg-cocoa-800 text-fg' : 'text-fg-faint'}" aria-pressed={!useSticker} onclick={() => (useSticker = false)}>{data.profile.avatar_url ? 'My photo' : 'My initial'}</button>
		</div>
	</div>
	{#if useSticker}
		<div class="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-9">
			{#each STICKER_ICONS as icon (icon)}
				<button type="button" class="grid aspect-square place-items-center rounded-[12px] transition {stickerIcon === icon ? 'bg-mustard-400 text-cocoa-950' : 'bg-cocoa-800 text-fg-muted hover:text-fg'}" aria-label={icon} aria-pressed={stickerIcon === icon} onclick={() => (stickerIcon = icon)}>
					<Icon name={icon} size={20} />
				</button>
			{/each}
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each STICKER_INKS as ink (ink)}
				<button type="button" class="h-9 w-9 rounded-full ring-3 ring-offset-2 ring-offset-cocoa-850 transition {stickerInk === ink ? 'ring-mustard-400' : 'ring-transparent hover:ring-cocoa-600'}" style="background: {INKS[ink]}; box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.25)" aria-label={INK_NAMES[ink]} aria-pressed={stickerInk === ink} onclick={() => (stickerInk = ink)}></button>
			{/each}
		</div>
	{/if}

	<span class="label mt-5">Your paper</span>
	<PaperPicker bind:value={myPaper} name="paper" />

	<div class="mt-4 flex justify-end">
		<button class="btn-primary" disabled={lookBusy}>{lookSaved ? 'Saved' : lookBusy ? 'Saving…' : 'Save my look'}</button>
	</div>
</form>

{#if !data.authEnabled}
	<div class="mb-8 flex gap-3 rounded-[var(--radius-card)] bg-mustard-400/15 px-4 py-3 text-sm text-mustard-300">
		<Icon name="alert" size={20} />
		<span><span class="font-bold">Google sign-in isn’t switched on yet.</span> Until it is, the app has one shared account and people can’t join your circles. The README explains the two keys to add in Cloudflare.</span>
	</div>
{/if}

<!-- About you: birthday and sizes -->
<form
	method="POST"
	action="?/saveProfile"
	class="card mb-8 space-y-5 p-5"
	use:enhance={() => async ({ update, result }) => {
		await update({ reset: false });
		if (result.type === 'success') flash('Saved');
	}}
>
	<div>
		<h2 class="text-lg font-bold">About you</h2>
		<p class="mt-1 text-sm text-fg-muted">Your sizes fill in automatically when you add clothes, and givers can see them. You can always change the size on a single gift.</p>
	</div>
	<label class="block">
		<span class="label">Your birthday</span>
		<input class="field sm:max-w-56" type="date" name="birthday" value={data.profile.birthday ?? ''} />
		<span class="mt-1.5 block text-xs text-fg-faint">Shown to people in your circles so they know it’s coming up.</span>
	</label>
	<SizeFields sizes={data.profile.sizes} />
	<div class="flex items-center justify-end gap-3">
		{#if savedNote}<span class="text-sm font-bold text-teal-300">{savedNote}</span>{/if}
		<button class="btn-primary">Save</button>
	</div>
</form>

<!-- Kids -->
<section class="mb-8">
	<h2 class="mb-3 text-lg font-bold">Kids</h2>
	{#if data.kids.length}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each data.kids as kid (kid.id)}
				<div class="card flex items-center gap-3 p-3.5">
					<Avatar name={kid.name} size={44} />
					<div class="min-w-0 flex-1">
						<p class="font-bold">{kid.name}</p>
						<p class="text-xs text-fg-muted">{Object.values(kid.sizes).filter(Boolean).length ? 'Sizes saved' : 'No sizes yet'}</p>
					</div>
					<a href="/lists/mst_{kid.id}" class="btn-quiet text-sm">List</a>
					<button class="btn-ghost text-sm" onclick={() => { editingKid = kid; confirmRemove = false; kidOpen = true; }}>Edit</button>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-sm text-fg-muted">Keep wish lists for your kids, clearly labelled with their names. Add one from the <a href="/" class="font-bold text-mustard-400 hover:underline">Lists</a> page.</p>
	{/if}
</section>

<!-- Add from anywhere -->
<section id="anywhere" class="mb-8 scroll-mt-24">
	<h2 class="mb-1 text-lg font-bold">Add gifts from anywhere</h2>
	<p class="mb-4 text-sm text-fg-muted">Add gifts while you shop, without copying links.</p>
	<div class="grid gap-3 md:grid-cols-2">
		<div class="card p-5">
			<h3 class="flex items-center gap-2 font-bold"><Icon name="share" size={18} class="text-teal-300" />From your phone’s share menu</h3>
			<ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
				<li>Open The Giver in Chrome on Android and choose <span class="font-bold text-fg">Add to Home screen</span> (or <span class="font-bold text-fg">Install app</span>).</li>
				<li>In the Amazon app or any browser, tap <span class="font-bold text-fg">Share → The Giver</span>.</li>
			</ol>
			<p class="mt-3 text-xs text-fg-faint">On iPhone, Apple doesn’t let web apps join the share menu. Use the bookmark button instead; it works in Safari. You can still add The Giver to your Home Screen from Safari’s share menu.</p>
		</div>
		<div class="card p-5">
			<h3 class="flex items-center gap-2 font-bold"><Icon name="tag" size={18} class="text-mustard-400" />The bookmark button</h3>
			<p class="mt-2 text-sm text-fg-muted">On a computer, drag this to your bookmarks bar. Then, on any product page (or an Amazon wish list), click it.</p>
			<!-- svelte-ignore a11y_invalid_attribute -->
			<a href={code} class="btn-primary mt-3 cursor-grab" onclick={(e) => e.preventDefault()} draggable="true">
				<Icon name="gift" size={18} />Add to The Giver
			</a>
			<details class="mt-4 text-sm">
				<summary class="cursor-pointer font-bold text-fg-muted hover:text-fg">Dragging doesn’t work? (Zen, Firefox, iPhone)</summary>
				<div class="mt-2 space-y-3 text-fg-muted">
					<p><span class="font-bold text-fg">Zen or Firefox:</span> right-click the yellow button and choose <span class="font-bold text-fg">Bookmark Link…</span>. Then open it from your bookmarks (or press Ctrl+Shift+B to show the bookmarks bar).</p>
					<p><span class="font-bold text-fg">Any browser:</span>
						<button class="font-bold text-mustard-400 hover:underline" onclick={copyCode}>{copiedCode ? 'Copied!' : 'Copy the bookmark code'}</button>, make a new bookmark, name it “Add to The Giver” and paste the code as its address (URL).</p>
					<p><span class="font-bold text-fg">iPhone or iPad:</span> copy the code above. In Safari, bookmark any page, then edit that bookmark: rename it and paste the code as its address. On a product page, open Bookmarks and tap it.</p>
				</div>
			</details>
			<p class="mt-3 text-xs text-fg-faint">It reads the page in your own browser, so it works even when a shop blocks automatic lookups. On an Amazon wish list it brings in every item (scroll to the bottom first so they’ve all loaded).</p>
		</div>
	</div>
</section>

<section class="mb-8 grid gap-3 sm:grid-cols-2">
	<a href="/categories" class="card flex items-center gap-3 p-4 transition active:translate-y-0.5">
		<span class="grid h-11 w-11 place-items-center rounded-full bg-cocoa-950 text-mustard-400"><Icon name="tag" size={22} /></span>
		<span class="flex-1"><span class="block font-bold">Categories</span><span class="text-sm text-fg-muted">Make your own, with the details to ask for</span></span>
		<Icon name="chevron-right" size={18} />
	</a>
	<a href="/add" class="card flex items-center gap-3 p-4 transition active:translate-y-0.5">
		<span class="grid h-11 w-11 place-items-center rounded-full bg-cocoa-950 text-teal-300"><Icon name="link" size={22} /></span>
		<span class="flex-1"><span class="block font-bold">Import an Amazon wish list</span><span class="text-sm text-fg-muted">Paste its link (set it to Public or Shared first)</span></span>
		<Icon name="chevron-right" size={18} />
	</a>
</section>

<!-- Computers only: the paper pointer. -->
<label class="card mb-8 hidden cursor-pointer items-center gap-3 p-4 sm:flex">
	<span class="grid h-11 w-11 place-items-center rounded-full bg-cocoa-950 text-rust-300"><Icon name="sparkle" size={22} /></span>
	<span class="flex-1"><span class="block font-bold">Paper pointer</span><span class="text-sm text-fg-muted">A cream arrow that turns mustard over anything you can click</span></span>
	<input
		type="checkbox"
		class="h-6 w-6 rounded-md border-2 border-cocoa-600 bg-sunken text-rust-500 focus:ring-0 focus:ring-offset-0"
		checked={paperPointer}
		onchange={(e) => {
			paperPointer = e.currentTarget.checked;
			setPref('pointer', paperPointer ? 'paper' : 'normal');
			if (paperPointer) document.documentElement.dataset.pointer = 'paper';
			else delete document.documentElement.dataset.pointer;
		}}
	/>
</label>

{#if data.authEnabled}
	<form method="POST" action="/auth/logout">
		<button class="btn-quiet w-full justify-center text-rust-300">Sign out</button>
		<p class="mt-1 text-center text-xs text-fg-faint">Claims on your lists stay hidden on this device even after you sign out.</p>
	</form>
{/if}

<Modal bind:open={kidOpen} title="Edit {editingKid?.name ?? ''}">
	{#if editingKid}
		<form
			id="kid-form"
			method="POST"
			action="?/saveKid"
			class="space-y-5"
			use:enhance={() => async ({ update, result }) => {
				await update({ reset: false });
				if (result.type === 'success') kidOpen = false;
			}}
		>
			<input type="hidden" name="id" value={editingKid.id} />
			<label class="block"><span class="label">Name</span><input class="field" name="name" required maxlength="40" value={editingKid.name} /></label>
			<label class="block"><span class="label">Birthday</span><input class="field sm:max-w-56" type="date" name="birthday" value={editingKid.birthday ?? ''} /></label>
			<div>
				<span class="label">Sizes</span>
				<SizeFields sizes={editingKid.sizes} />
			</div>
			{#if form?.kidError}<p class="text-sm font-bold text-rust-300">{form.kidError}</p>{/if}
		</form>
		<div class="mt-8 rounded-[var(--radius-card)] bg-rust-500/10 p-4">
			<form method="POST" action="?/deleteKid" use:enhance={() => async ({ update }) => { await update(); kidOpen = false; }} class="flex items-center justify-between gap-4">
				<input type="hidden" name="id" value={editingKid.id} />
				<p class="text-sm text-fg-muted">Remove {editingKid.name} and all their lists and gifts.</p>
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
			<button type="button" class="btn-quiet" onclick={() => (kidOpen = false)}>Cancel</button>
			<button form="kid-form" class="btn-primary">Save</button>
		</div>
	{/snippet}
</Modal>
