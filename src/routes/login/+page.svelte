<script lang="ts">
	import Present from '#lib/components/Present.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Sign in · The Giver</title></svelte:head>

<div class="mx-auto max-w-md">
	<!-- A present on a shelf, with its tag swinging. -->
	<div class="group relative mx-auto mt-2 w-[58%] max-w-72">
		<Present occasion="birthday" wrap="candy" ribbonAt={50} class="paper-grain aspect-[4/3] w-full rounded-[18px] shadow-[inset_0_-10px_0_rgb(0_0_0/0.12)]" />
		<span class="welcome-swing absolute -right-4 bottom-8 origin-top-left rotate-6">
			<span class="tag-shape block bg-cream px-4 pt-5 pb-3 text-center text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)]">
				<span class="mx-auto mb-1 block h-2.5 w-2.5 rounded-full bg-cocoa-950"></span>
				<span class="block text-[10px] font-bold tracking-widest text-rust-500 uppercase">To</span>
				<span class="display block text-xl leading-none">you</span>
			</span>
		</span>
	</div>
	<div class="shelf-plank mx-auto w-[72%] max-w-80"></div>

	<div class="mt-6 px-2 text-center">
		<h1 class="display text-[36px] leading-tight">Welcome in</h1>
		<ul class="mx-auto mt-4 max-w-xs space-y-2 text-left text-[15px] text-fg-muted">
			<li class="flex items-center gap-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mustard-400 text-cocoa-950"><Icon name="gift" size={17} /></span>One list of everything you’d love</li>
			<li class="flex items-center gap-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-300 text-cocoa-950"><Icon name="share" size={16} /></span>Share it with the people who buy for you</li>
			<li class="flex items-center gap-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rust-300 text-cocoa-950"><Icon name="check" size={17} /></span>Nobody gets the same thing twice</li>
		</ul>
			<a href="/auth/google?next={encodeURIComponent(data.next)}" class="btn-primary mt-6 w-full">
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.33zM12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22zm-5.6-8.1a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96L6.4 13.9zM12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.52L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98z" /></svg>
				Continue with Google
			</a>
			{#if data.cancelled}<p class="mt-4 text-sm font-bold text-rust-300">Sign-in was cancelled. Try again whenever you’re ready.</p>{/if}
			<p class="mt-5 text-xs text-fg-faint">We only use your name, email and picture, so your family and friends know it’s you.</p>
	</div>
</div>
