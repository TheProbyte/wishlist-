<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Logo from '#lib/components/Logo.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { goto, onNavigate, preloadData } from '$app/navigation';
	import { TABS, navDirection, pageSwipe, prefersReducedMotion, setNavDirection, tabIndex } from '#lib/motion.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	// Pages givers see through a share link: no app navigation.
	const shared = $derived(page.url.pathname.startsWith('/s/') || page.url.pathname.startsWith('/u/'));
	const active = $derived(tabIndex(page.url.pathname));
	const onTabRoot = $derived(TABS.some((t) => t.href === page.url.pathname));

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

	// Swipe sideways between the three tabs. The page follows the finger (pageSwipe).
	const tabHref = (i: number) => TABS[i]?.href;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>The Giver</title>
</svelte:head>

<header class="sticky top-0 z-40 bg-cocoa-950" style="view-transition-name: site-header">
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
		<a href={shared ? page.url.pathname : '/'} class="flex items-center gap-2.5">
			<Logo />
			<span class="display text-[22px] text-fg">The Giver</span>
		</a>
		{#if !shared}
			<nav class="hidden items-center gap-1 sm:flex" aria-label="Main">
				{#each TABS as tab, i (tab.href)}
					<a href={tab.href} aria-current={active === i ? 'page' : undefined} class="relative flex min-h-11 items-center px-3 text-[15px] font-bold transition {active === i ? 'text-fg' : 'text-fg-faint hover:text-fg'}">
						{tab.label}
						{#if active === i}<span class="stripes absolute inset-x-3 bottom-1.5 h-[6px] rounded-full"></span>{/if}
					</a>
				{/each}
			</nav>
		{/if}
	</div>
	<div class="stripes h-[12px]" aria-hidden="true"></div>
</header>

<main
	class="mx-auto max-w-6xl px-4 pt-7 sm:px-6 sm:pt-10 {shared ? 'pb-24' : 'pb-32 sm:pb-24'}"
	use:pageSwipe={{
		enabled: onTabRoot,
		canLeft: active < TABS.length - 1,
		canRight: active > 0,
		left: () => goto(tabHref(active + 1)!),
		right: () => goto(tabHref(active - 1)!),
		preload: (d) => {
			const href = tabHref(d === 'left' ? active + 1 : active - 1);
			if (href) preloadData(href);
		}
	}}
>
	{@render children()}
</main>

{#if !shared}
	<!-- Phones: tab bar at the bottom, in thumb reach. The stripe marker slides to the active tab. -->
	<nav
		class="fixed inset-x-0 bottom-0 z-40 bg-cocoa-950 pb-[env(safe-area-inset-bottom)] shadow-[0_-3px_0_0_var(--color-edge)] sm:hidden"
		style="view-transition-name: tab-bar"
		aria-label="Main"
	>
		<div class="relative grid grid-cols-4">
			{#if active >= 0}
				<span
					class="stripes absolute top-0 left-0 h-[6px] w-1/4 transition-transform duration-300 ease-[var(--ease-spring)]"
					style="transform: translateX({active * 100}%)"
					aria-hidden="true"
				></span>
			{/if}
			{#each TABS as tab, i (tab.href)}
				<a
					href={tab.href}
					aria-current={active === i ? 'page' : undefined}
					class="flex min-h-16 flex-col items-center justify-center gap-1 pt-1.5 text-[11px] font-bold transition {active === i ? 'text-fg' : 'text-fg-faint'}"
					onclick={() => setNavDirection(i === active ? 'close' : i > active ? 'next' : 'prev')}
				>
					<Icon name={tab.icon} size={22} class="transition-transform duration-300 {active === i ? '-translate-y-0.5 text-mustard-400' : ''}" />
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
{/if}
