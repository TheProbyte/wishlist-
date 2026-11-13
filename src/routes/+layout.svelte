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

<header class="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/75 backdrop-blur-xl">
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
		<a href={shared ? page.url.pathname : '/'} class="flex items-center gap-2.5">
			<Logo />
			<span class="font-display text-lg font-semibold tracking-tight">The Giver</span>
		</a>
		{#if !shared}
			<nav class="flex items-center gap-1">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="rounded-lg px-3 py-1.5 text-sm font-medium transition {isActive(item.href)
							? 'bg-ink-800 text-fg'
							: 'text-fg-muted hover:text-fg'}">{item.label}</a
					>
				{/each}
			</nav>
		{/if}
	</div>
</header>

<main class="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-10">
	{@render children()}
</main>
