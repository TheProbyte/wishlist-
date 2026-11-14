<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getPref, setPref } from '#lib/prefs.ts';
	import { dur, prefersReducedMotion } from '#lib/motion.ts';
	import Icon from './Icon.svelte';

	/**
	 * The front door for givers: the first time someone opens a share link, a gift tag swings in
	 * ("To: you · From: Kade"), then flips over to say how it works. Once per link, per device.
	 */
	let { token, from, listName }: { token: string; from: string | null; listName: string } = $props();

	let open = $state(false);
	// The tag turns edge-on, swaps to its other side, and turns back: a flip with no hidden faces.
	let side = $state<'front' | 'back'>('front');
	let turning = $state(false);
	function flip() {
		if (side === 'back' || turning) return;
		if (prefersReducedMotion()) return void (side = 'back');
		turning = true;
		setTimeout(() => {
			side = 'back';
			turning = false;
		}, 230);
	}
	onMount(() => {
		if (getPref(`welcome:${token}`)) return;
		open = true;
		setTimeout(flip, prefersReducedMotion() ? 0 : 1500);
	});
	function done() {
		setPref(`welcome:${token}`, '1');
		open = false;
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[80] grid place-items-center bg-[#120b07]/85 p-6" transition:fade={{ duration: dur(200) }} role="dialog" aria-modal="true" aria-label="Welcome">
		<!-- The string the tag hangs from. -->
		<div class="welcome-swing relative w-full max-w-[340px]">
			<svg class="absolute -top-16 left-1/2 -translate-x-1/2" width="60" height="70" viewBox="0 0 60 70" aria-hidden="true">
				<path d="M30 0 C30 30 20 40 30 62" fill="none" stroke="var(--color-cream)" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
			</svg>
			<div class="welcome-card relative h-[380px] w-full {turning ? 'is-turning' : ''}">
				{#if side === 'front'}
				<!-- Front: who it's for and from. -->
				<button class="tag-shape paper-grain absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cream px-8 text-center text-cocoa-950" onclick={flip} aria-label="Turn the tag over">
					<span class="absolute top-6 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-cocoa-950 ring-4 ring-mustard-400"></span>
					<span class="text-sm font-bold tracking-widest text-rust-500 uppercase">To</span>
					<span class="display text-[44px] leading-none">you</span>
					<span class="mt-3 text-sm font-bold tracking-widest text-rust-500 uppercase">From</span>
					<span class="display text-[34px] leading-none">{from ?? 'a friend'}</span>
					<span class="mt-4 text-sm text-cocoa-700">{listName}</span>
				</button>
				{:else}
				<!-- Back: how it works. -->
				<div class="tag-shape absolute inset-0 flex flex-col justify-center gap-4 bg-cocoa-850 px-7 pt-10 text-left">
					<span class="absolute top-6 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-cocoa-950 ring-4 ring-mustard-400"></span>
					<h2 class="display text-center text-[26px] leading-tight">How it works</h2>
					<ol class="space-y-3 text-[15px] text-fg-muted">
						<li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mustard-400 text-sm font-bold text-cocoa-950">1</span><span>Find something you’d like to give. Tap it for the details.</span></li>
						<li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-300 text-sm font-bold text-cocoa-950">2</span><span>Tap <span class="font-bold text-teal-300">I’ll get this</span>. Everyone else sees it’s taken, so nobody doubles up.</span></li>
						<li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rust-300 text-sm font-bold text-cocoa-950">3</span><span>{from ?? 'They'} never see{from ? 's' : ''} who’s getting what. It stays a surprise.</span></li>
					</ol>
					<button class="btn-primary mt-2 w-full" onclick={done}>Let’s look <Icon name="chevron-right" size={18} /></button>
				</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
