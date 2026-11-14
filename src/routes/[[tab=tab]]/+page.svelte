<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, replaceState, snapshot } from '$app/navigation';
	import ListsTab from '#lib/tabs/ListsTab.svelte';
	import PeopleTab from '#lib/tabs/PeopleTab.svelte';
	import MeTab from '#lib/tabs/MeTab.svelte';
	import PasteBar from '#lib/components/PasteBar.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { shell } from '#lib/shell.svelte.ts';
	import { TABS, prefersReducedMotion } from '#lib/motion.ts';
	import type { TabForm } from '#lib/tabs/types.ts';
	import type { PageProps } from './$types';

	/**
	 * Lists, People and You side by side. Swiping between them is the phone's own sideways
	 * scroll, so the next tab is already under your finger; the header, tab bar and paste bar
	 * stay put around it. Each tab keeps its own scroll position.
	 */
	let { data, form }: PageProps = $props();

	const ORDER = ['lists', 'people', 'me'] as const;
	const TITLES = ['Your lists', 'People', 'You'];

	let strip = $state<HTMLDivElement>();
	let panels: HTMLElement[] = $state([]);
	// svelte-ignore state_referenced_locally
	let progress = $state(Math.max(0, ORDER.indexOf(data.tab as (typeof ORDER)[number])));
	const current = $derived(Math.min(ORDER.length - 1, Math.max(0, Math.round(progress))));
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	let frame = 0;

	function onscroll() {
		if (!strip) return;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			if (!strip) return;
			progress = strip.scrollLeft / Math.max(1, strip.clientWidth);
			shell.progress = progress;
		});
		clearTimeout(settleTimer);
		settleTimer = setTimeout(settle, 140);
	}

	// Once a swipe settles, the address bar follows (without reloading anything).
	function settle() {
		const href = TABS[current].href;
		// (page.url doesn't follow a shallow replaceState, so compare with the real address.)
		if (location.pathname !== href) replaceState(href, {});
		document.title = `${TITLES[current]} · The Giver`;
	}

	function go(i: number, smooth = true) {
		if (!strip) return;
		strip.scrollTo({ left: i * strip.clientWidth, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
		if (!smooth) {
			progress = i;
			shell.progress = i;
			settle();
		}
	}

	onMount(() => {
		shell.active = true;
		shell.go = (i) => go(i);
		// Tapping the tab you're already on: back to its top, or (on Lists, already at the top)
		// straight into Everything.
		shell.reselect = (i) => {
			const panel = panels[i];
			if (panel && panel.scrollTop > 40) return panel.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
			if (i === 0) goto(`/lists/${data.listsTab.everything.id}`);
		};
		go(progress, false);
		// Links like /me#anywhere: scroll that section into view inside its tab.
		if (location.hash.length > 1) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }));
		// Stay on the same tab when the screen turns or resizes.
		const ro = new ResizeObserver(() => strip && (strip.scrollLeft = current * strip.clientWidth));
		if (strip) ro.observe(strip);
		return () => {
			ro.disconnect();
			shell.active = false;
		};
	});

	// Going back to this page puts you on the same tab, scrolled where you were.
	snapshot<{ tab: number; scrolls: number[] }>({
		id: 'tabs',
		capture: () => ({ tab: current, scrolls: panels.map((p) => p?.scrollTop ?? 0) }),
		restore: (v) => {
			go(v.tab, false);
			requestAnimationFrame(() => v.scrolls.forEach((y, i) => panels[i] && (panels[i].scrollTop = y)));
		}
	});

	// The paste bar belongs to Lists: it fades and sinks away as you swipe off it.
	const pasteShown = $derived(Math.max(0, 1 - progress * 1.8));
	// ...and steps out of the way while you scroll down the shelf, back as soon as you scroll up
	// (or reach the top). Also away while the shelf is being arranged.
	let scrolledAway = $state(false);
	let lastY = 0;
	function onListsScroll(e: Event) {
		const y = (e.currentTarget as HTMLElement).scrollTop;
		const dy = y - lastY;
		if (Math.abs(dy) < 6) return;
		scrolledAway = dy > 0 && y > 80;
		lastY = y;
	}
	const pasteAway = $derived(scrolledAway || shell.pasteHidden);
	let plusOpen = $state(false);
	const tabForm = $derived(form as TabForm);
</script>

<svelte:head><title>{TITLES[current]} · The Giver</title></svelte:head>

<div
	bind:this={strip}
	{onscroll}
	class="no-scrollbar flex h-[calc(100dvh-var(--header-h))] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
>
	{#each ORDER as tab, i (tab)}
		<section
			bind:this={panels[i]}
			data-ptr
			onscroll={i === 0 ? onListsScroll : undefined}
			class="h-full w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain"
			inert={current !== i}
			aria-label={TITLES[i]}
		>
			<div class="mx-auto max-w-6xl px-4 pt-7 pb-[calc(10rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 sm:pb-24">
				{#if tab === 'lists'}
					<ListsTab data={data.listsTab} form={tabForm} me={data.me} />
				{:else if tab === 'people'}
					<PeopleTab data={data.peopleTab} form={tabForm} me={data.me} />
				{:else}
					<MeTab data={data.meTab} form={tabForm} me={data.me} />
				{/if}
			</div>
		</section>
	{/each}
</div>

<!-- Phones: paste bar docked above the tab bar, on the Lists tab. -->
<div
	class="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 sm:hidden"
	style="opacity: {pasteShown}; transform: translateY({(1 - pasteShown) * 24}px); pointer-events: {pasteShown > 0.5 ? 'auto' : 'none'}"
	aria-hidden={pasteShown < 0.5}
>
	<div class="transition-[transform,opacity] duration-300 ease-[var(--ease-out-soft)] {pasteAway ? 'pointer-events-none translate-y-[calc(100%+5.5rem)] opacity-0' : ''}">
		<PasteBar class="shadow-[0_3px_0_0_var(--color-edge),0_12px_32px_-8px_rgb(0_0_0/0.75)]" onplus={() => (plusOpen = true)} />
	</div>
</div>

<Modal bind:open={plusOpen} title="Add a gift">
	<div class="space-y-2">
		<button class="card flex w-full items-center gap-3 p-4 text-left" onclick={() => { plusOpen = false; goto('/add?manual=1'); }}>
			<span class="grid h-11 w-11 place-items-center rounded-full bg-mustard-400 text-cocoa-950"><Icon name="plus" size={22} /></span>
			<span><span class="block font-bold">Add by hand</span><span class="text-sm text-fg-muted">Anything, no link needed. Add your own photo.</span></span>
		</button>
		<button class="card flex w-full items-center gap-3 p-4 text-left" onclick={() => { plusOpen = false; go(2); setTimeout(() => document.getElementById('anywhere')?.scrollIntoView({ behavior: 'smooth' }), 350); }}>
			<span class="grid h-11 w-11 place-items-center rounded-full bg-teal-600 text-cream"><Icon name="share" size={20} /></span>
			<span><span class="block font-bold">From a shop or Amazon wish list</span><span class="text-sm text-fg-muted">Set up the share menu and the bookmark button.</span></span>
		</button>
	</div>
</Modal>
