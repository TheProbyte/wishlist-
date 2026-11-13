<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Logo from '#lib/components/Logo.svelte';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const shared = $derived(page.url.pathname.startsWith('/s/'));
	const nav = [
		{ href: '/', label: 'Lists' },
		{ href: '/categories', label: 'Categories' }
	];
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' || page.url.pathname.startsWith('/lists') : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>The Giver</title>
</svelte:head>

<header class="sticky top-0 z-40 bg-cocoa-950">
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
		<a href={shared ? page.url.pathname : '/'} class="flex items-center gap-2.5">
			<Logo />
			<span class="display text-[22px] text-fg">The Giver</span>
		</a>
		{#if !shared}
			<nav class="flex items-center gap-1">
				{#each nav as item (item.href)}
					<a href={item.href} class="relative flex min-h-11 items-center px-3 text-[15px] font-bold transition {isActive(item.href) ? 'text-fg' : 'text-fg-faint hover:text-fg'}">
						{item.label}
						{#if isActive(item.href)}<span class="stripes absolute inset-x-3 bottom-1.5 h-[6px] rounded-full"></span>{/if}
					</a>
				{/each}
			</nav>
		{/if}
	</div>
	<div class="stripes h-[12px]" aria-hidden="true"></div>
</header>

<main class="mx-auto max-w-6xl px-4 pt-7 pb-24 sm:px-6 sm:pt-10">
	{@render children()}
</main>
