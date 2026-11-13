<script lang="ts">
	import Present from '#lib/components/Present.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Sign in · The Giver</title></svelte:head>

<div class="mx-auto max-w-md">
	<div class="card overflow-hidden">
		<Present occasion="birthday" class="h-44 rounded-t-[var(--radius-card)]" />
		<div class="px-6 pt-7 pb-8 text-center">
			<h1 class="display text-[34px] leading-tight">Welcome in</h1>
			<p class="mx-auto mt-3 max-w-xs text-fg-muted">Keep one list of everything you’d love, share it with the people who buy for you, and never get the same thing twice.</p>
			<a href="/auth/google?next={encodeURIComponent(data.next)}" class="btn-primary mt-7 w-full">
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.33zM12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22zm-5.6-8.1a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96L6.4 13.9zM12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.52L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98z" /></svg>
				Continue with Google
			</a>
			{#if data.cancelled}<p class="mt-4 text-sm font-bold text-rust-300">Sign-in was cancelled. Try again whenever you’re ready.</p>{/if}
			<p class="mt-5 text-xs text-fg-faint">We only use your name, email and picture, so your family and friends know it’s you.</p>
		</div>
	</div>
</div>
