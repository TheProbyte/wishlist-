<script lang="ts">
	import { thumb } from '#lib/format.ts';
	import { PAPERS } from '#lib/papers.ts';
	import Icon from './Icon.svelte';

	/**
	 * A gift's photo on a soft cream tile (product shots are made for white backgrounds).
	 *
	 * - The photo lifts in like tissue paper coming off when it loads.
	 * - No photo (or one that won't load): the gift's category drawn on a swatch of wrapping
	 *   paper, chosen from `seed` (the gift's id) so the same gift always gets the same paper.
	 *
	 * `size`: the largest it's shown, in CSS pixels; a smaller copy is fetched where the shop has one.
	 */
	let {
		src,
		alt = '',
		size,
		icon = null,
		seed = '',
		class: cls = ''
	}: { src: string | null | undefined; alt?: string; size?: number; icon?: string | null; seed?: string; class?: string } = $props();

	const url = $derived(size ? thumb(src, Math.min(1500, Math.round(size * 2))) : src);
	// Which address has loaded (or failed). Tied to the address, not reset by re-renders: saving a
	// gift re-renders its card with the same photo, which must stay shown.
	let loadedUrl = $state<string | null>(null);
	let failedUrl = $state<string | null>(null);
	const loaded = $derived(!!url && loadedUrl === url);
	const failed = $derived(!!url && failedUrl === url);
	let img = $state<HTMLImageElement>();
	// Already in the cache: no lift, just there.
	$effect(() => {
		if (img && url && img.complete && img.naturalWidth) loadedUrl = url;
	});

	function hash(s: string) {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
		return Math.abs(h);
	}
	const paper = $derived(PAPERS[hash(seed || alt || 'gift') % PAPERS.length]);
	const iconSize = $derived(Math.round(Math.max(18, Math.min(64, (size ?? 120) * 0.22))));
</script>

<div class="relative grid place-items-center overflow-hidden bg-cream {cls}">
	{#if url && !failed}
		<img
			bind:this={img}
			src={url}
			{alt}
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			class="h-full w-full object-contain p-3 mix-blend-multiply transition-[opacity,transform] duration-500 ease-[var(--ease-out-soft)] {loaded ? 'opacity-100' : 'scale-[0.97] opacity-0'}"
			onload={() => (loadedUrl = url ?? null)}
			onerror={() => (failedUrl = url ?? null)}
		/>
		{#if !loaded}
			<!-- Tissue paper over the photo until it arrives; it lifts away as the photo loads. -->
			<span class="tissue pointer-events-none absolute inset-0" aria-hidden="true"></span>
		{:else}
			<span class="tissue tissue-lift pointer-events-none absolute inset-0" aria-hidden="true"></span>
		{/if}
	{:else}
		<!-- No photo: the gift's kind, on a swatch of wrapping paper. -->
		<span class="absolute inset-0 opacity-90" style="background: {paper.background}" aria-hidden="true"></span>
		<span
			class="relative grid aspect-square w-[44%] max-w-28 min-w-9 place-items-center rounded-full bg-cream text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)] ring-3 ring-cocoa-950/80"
			aria-hidden="true"
		>
			<Icon name={icon || 'gift'} size={iconSize} />
		</span>
	{/if}
</div>
