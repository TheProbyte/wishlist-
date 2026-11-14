<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { bookmarklet } from '#lib/bookmarklet.ts';

	/** Add from anywhere: the share menu, the bookmark button, and importing an Amazon wish list. */
	const code = $derived(bookmarklet(page.url.origin));
	let copiedCode = $state(false);
	async function copyCode() {
		await navigator.clipboard.writeText(code);
		copiedCode = true;
		setTimeout(() => (copiedCode = false), 1800);
	}
</script>

<svelte:head><title>Add from anywhere · The Giver</title></svelte:head>

<a href="/me" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />You</a>
<h1 class="display accent-bar mb-2 text-[34px] leading-tight">Add from anywhere</h1>
<p class="mb-6 max-w-lg text-fg-muted">Add gifts while you shop, without copying links.</p>

<!-- Add from anywhere -->
<section id="anywhere" class="mb-8 scroll-mt-24">
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

<a href="/add" class="card mb-8 flex items-center gap-3 p-4 transition active:translate-y-0.5">
	<span class="grid h-11 w-11 place-items-center rounded-full bg-cocoa-950 text-teal-300"><Icon name="link" size={22} /></span>
	<span class="flex-1"><span class="block font-bold">Import an Amazon wish list</span><span class="text-sm text-fg-muted">Paste its link (set it to Public or Shared first)</span></span>
	<Icon name="chevron-right" size={18} />
</a>
