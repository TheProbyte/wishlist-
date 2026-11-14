<script lang="ts">
	// Fonts ship with the app (cached on the phone) instead of coming from Google each time.
	import '@fontsource-variable/dm-sans/opsz.css';
	import '@fontsource/shrikhand/latin-400.css';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Logo from '#lib/components/Logo.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { navigating, page } from '$app/state';
	import { afterNavigate, goto, onNavigate, preloadCode, preloadData } from '$app/navigation';
	import { edgeBack } from '#lib/edgeBack.ts';
	import PullRibbon from '#lib/components/PullRibbon.svelte';
	import PageSkeleton from '#lib/components/PageSkeleton.svelte';
	import ContextMenu from '#lib/components/ContextMenu.svelte';
	import { contextMenu, closeMenu, type MenuSpec } from '#lib/menu.svelte.ts';
	import { getPref } from '#lib/prefs.ts';
	import { onMount } from 'svelte';
	import { TABS, navDirection, prefersReducedMotion, setNavDirection, tabIndex } from '#lib/motion.ts';
	import { shell } from '#lib/shell.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	// Pages givers see through a share link: no app navigation.
	const shared = $derived(page.url.pathname.startsWith('/s/') || page.url.pathname.startsWith('/u/'));
	// Signing in: no app tabs yet (they'd only lead back here).
	const signingIn = $derived(page.url.pathname.startsWith('/login'));
	// On the tab pager the active tab follows the swipe; elsewhere it's from the address.
	const onPager = $derived(page.route.id === '/[[tab=tab]]');
	const active = $derived(onPager && shell.active ? Math.round(shell.progress) : tabIndex(page.url.pathname));
	const marker = $derived(onPager && shell.active ? shell.progress : active);

	function tabClick(e: MouseEvent, i: number) {
		if (onPager && shell.active) {
			e.preventDefault();
			if (i === active) shell.reselect(i);
			else shell.go(i);
		} else setNavDirection(i === active ? 'close' : i > active ? 'next' : 'prev');
	}

	// Page changes slide in the direction of travel, where the browser supports view transitions.
	onNavigate((nav) => {
		// Always read the direction, so one set for a navigation that doesn't happen can't leak into the next.
		const direction = navDirection(nav.from?.url.pathname ?? '', nav.to?.url.pathname ?? '');
		if (direction === 'none' || !document.startViewTransition || prefersReducedMotion() || !nav.from || !nav.to) return;
		if (nav.from.url.pathname === nav.to.url.pathname) return;
		document.documentElement.dataset.nav = direction;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	});

	// One accent colour per tab (Lists mustard, People teal, You rust), following the swipe.
	$effect(() => {
		document.documentElement.dataset.accent = ['lists', 'people', 'me'][shared ? 0 : Math.max(0, active)] ?? 'lists';
	});

	// The paper pointer (a choice on the You page), and seasonal stripes in the header.
	onMount(() => {
		// The paper pointer is on for mice unless you've turned it off on the You page.
		if (getPref('pointer') !== 'normal' && matchMedia('(pointer: fine)').matches) document.documentElement.dataset.pointer = 'paper';
		const d = new Date();
		const m = d.getMonth();
		const day = d.getDate();
		if (m === 11) document.documentElement.dataset.season = 'winter';
		else if (m === 1 && day <= 14) document.documentElement.dataset.season = 'hearts';
	});

	// Givers' share pages stay ordinary web pages (text can be selected there, and so on).
	$effect(() => {
		document.documentElement.toggleAttribute('data-shared', shared);
	});

	// No browser menu in the app: things that have options get the app's own menu (hold or
	// right-click them); everything else, nothing. Typing fields keep theirs (paste and so on),
	// and givers' share pages are left as ordinary web pages.
	onMount(() => {
		const block = (e: Event) => {
			if (shared || e.defaultPrevented) return;
			if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable], .selectable')) return;
			e.preventDefault();
		};
		addEventListener('contextmenu', block);
		return () => removeEventListener('contextmenu', block);
	});

	/** Shortcuts on each tab: hold it (or right-click it) to jump straight to the useful things. */
	async function ask(request: string, tab: number) {
		shell.request = request;
		if (onPager && shell.active) shell.go(tab);
		else await goto(TABS[tab].href);
	}
	function tabMenu(i: number): MenuSpec {
		if (i === 0)
			return {
				title: 'Lists',
				items: [
					{ label: 'New list', icon: 'plus', run: () => ask('new-list', 0) },
					{ label: 'Share all', icon: 'share', run: () => ask('share-all', 0) },
					{ label: 'Coming up', icon: 'calendar', href: '/upcoming' }
				]
			};
		if (i === 1)
			return {
				title: 'People',
				items: [
					{ label: 'Gifts I’m getting', icon: 'gift', href: '/getting' },
					{ label: 'New circle', icon: 'people', run: () => ask('new-circle', 1) },
					{ label: 'Start a Secret Santa', icon: 'shuffle', run: () => ask('new-santa', 1) }
				]
			};
		return {
			title: 'You',
			items: [
				{ label: 'Look & feel', icon: 'palette', href: '/me/look' },
				{ label: 'Categories', icon: 'tag', href: '/categories' }
			]
		};
	}

	// While a page is on its way (and only if it takes more than a moment), the header's stripes run.
	let loading = $state(false);
	// A list or person page that's slow to arrive gets cardboard stand-ins in its place.
	let placeholder = $state<'list' | 'person' | null>(null);
	$effect(() => {
		const to = navigating.to;
		if (!to) {
			loading = false;
			placeholder = null;
			return;
		}
		const kind = to.route.id === '/lists/[id]' ? 'list' : to.route.id === '/people/[id]' ? 'person' : null;
		const t = setTimeout(() => (loading = true), 120);
		const p = setTimeout(() => {
			// Not while a present is opening: it covers the screen itself.
			if (kind && !document.documentElement.hasAttribute('data-opening')) placeholder = kind;
		}, 220);
		return () => {
			clearTimeout(t);
			clearTimeout(p);
		};
	});

	// Swipe back from the left edge on any page that isn't a tab. Goes back through the app's
	// own history when there is some, otherwise up to the page this one belongs to.
	let depth = 0;
	let arrived: (() => void) | null = null;
	afterNavigate((nav) => {
		if (nav.type === 'enter') depth = 0;
		else if (nav.type === 'popstate') depth = Math.max(0, depth + (nav.delta ?? -1));
		else depth++;
		arrived?.();
		arrived = null;
		closeMenu();
	});
	function parentOf(path: string): { href: string; label: string } {
		if (/^\/(people\/|getting|circles|santa)/.test(path)) return { href: '/people', label: 'People' };
		if (/^\/(categories|me\/)/.test(path)) return { href: '/me', label: 'You' };
		return { href: '/', label: 'Lists' };
	}
	onMount(() =>
		edgeBack({
			enabled: () => !onPager && !shared,
			label: () => parentOf(page.url.pathname).label,
			back: () => {
				if (depth > 0) {
					const done = new Promise<void>((r) => (arrived = r));
					history.back();
					return done;
				}
				return goto(parentOf(page.url.pathname).href);
			}
		})
	);

	// Get the tabs ready in the background once the app has settled, so going back is instant.
	onMount(() => {
		if (shared) return;
		const warm = () => {
			preloadCode('/[[tab=tab]]');
			if (!onPager) preloadData('/').catch(() => {});
		};
		const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
		if (idle) idle(warm);
		else setTimeout(warm, 800);
	});

</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>The Giver</title>
</svelte:head>

<header class="sticky top-0 z-40 bg-cocoa-950 pt-[env(safe-area-inset-top)]" style="view-transition-name: site-header">
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
		<a href={shared ? page.url.pathname : '/'} class="flex items-center gap-2.5">
			<Logo />
			<span class="display text-[22px] text-fg">The Giver</span>
		</a>
		{#if !shared && !signingIn}
			<nav class="hidden items-center gap-1 sm:flex" aria-label="Main">
				{#each TABS as tab, i (tab.href)}
					<a href={tab.href} use:contextMenu={{ spec: () => tabMenu(i) }} onclick={(e) => tabClick(e, i)} aria-current={active === i ? 'page' : undefined} class="relative flex min-h-11 items-center px-3 text-[15px] font-bold transition {active === i ? 'text-fg' : 'text-fg-faint hover:text-fg'}">
						{tab.label}
						{#if active === i}<span class="stripes absolute inset-x-3 bottom-1.5 h-[6px] rounded-full"></span>{/if}
					</a>
				{/each}
			</nav>
		{/if}
	</div>
	{#if !shared}<PullRibbon />{/if}
	<div class="relative h-[12px]" aria-hidden="true">
		<div class="stripes h-full"></div>
		{#if loading}<div class="stripes-run absolute inset-0 opacity-90" role="progressbar" aria-label="Loading"></div>{/if}
	</div>
</header>

<!-- The tab pager fills the space itself; other pages scroll as normal pages. -->
<main class={onPager ? 'overflow-hidden' : `mx-auto max-w-6xl px-4 pt-7 sm:px-6 sm:pt-10 ${shared ? 'pb-24' : 'pb-52 sm:pb-24'}`}>
	{#if placeholder}<PageSkeleton kind={placeholder} />{:else}{@render children()}{/if}
</main>

{#if !shared && !signingIn}
	<!-- Phones: tab bar at the bottom, in thumb reach. The stripe marker slides to the active tab. -->
	<nav
		class="fixed inset-x-0 bottom-0 z-40 bg-cocoa-950 pb-[env(safe-area-inset-bottom)] shadow-[0_-3px_0_0_var(--color-edge)] sm:hidden"
		style="view-transition-name: tab-bar"
		aria-label="Main"
	>
		<div class="relative grid grid-cols-3">
			{#if active >= 0}
				<!-- Follows the finger while swiping tabs; springs into place otherwise. -->
				<span
					class="stripes absolute top-0 left-0 h-[6px] w-1/3 {onPager && shell.active ? '' : 'transition-transform duration-300 ease-[var(--ease-spring)]'}"
					style="transform: translateX({marker * 100}%)"
					aria-hidden="true"
				></span>
			{/if}
			{#each TABS as tab, i (tab.href)}
				<a
					href={tab.href}
					use:contextMenu={{ spec: () => tabMenu(i) }}
					aria-current={active === i ? 'page' : undefined}
					class="flex min-h-16 flex-col items-center justify-center gap-1 pt-1.5 text-[11px] font-bold transition {active === i ? 'text-fg' : 'text-fg-faint'}"
					onclick={(e) => tabClick(e, i)}
				>
					<Icon name={tab.icon} size={22} class="transition-transform duration-300 {active === i ? '-translate-y-0.5 text-[var(--accent)]' : ''}" />
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
{/if}

<ContextMenu />
