<script lang="ts">
	import Icon from './Icon.svelte';
	import { readSticker } from '#lib/stickers.ts';

	/**
	 * A person: their chosen sticker (an icon on a colour, with a cream edge like a real
	 * sticker), else their picture, else their initial on a palette colour.
	 */
	let { name, src = null, sticker = null, size = 36 }: { name: string; src?: string | null; sticker?: string | null; size?: number } = $props();
	const COLORS = ['#E8A83A', '#D2602D', '#3E8E87', '#F3E7CF'];
	const color = $derived(COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length]);
	const st = $derived(readSticker(sticker));
	let failed = $state(false);
	let loaded = $state(false);
	let img = $state<HTMLImageElement>();
	// Already in the browser's cache: show it at once, no fade.
	$effect(() => {
		if (img?.complete && img.naturalWidth) loaded = true;
	});
	// Google profile photos come in any size: ask for one that fits (sharp on retina, small to fetch).
	const sized = $derived(src && /googleusercontent\.com\/.+=s\d+(-c)?$/.test(src) ? src.replace(/=s\d+(-c)?$/, `=s${Math.round(size * 2)}-c`) : src);
</script>

{#if st}
	<span
		class="relative grid shrink-0 -rotate-6 place-items-center rounded-full shadow-[0_2px_0_0_var(--color-edge)]"
		style="width: {size}px; height: {size}px; background: {st.bg}; color: {st.fg}; box-shadow: 0 0 0 {Math.max(2, size * 0.06)}px var(--color-cream), 0 {Math.max(2, size * 0.06) + 2}px 0 0 var(--color-edge)"
		role="img"
		aria-label={name}
	>
		<Icon name={st.icon} size={Math.round(size * 0.52)} />
	</span>
{:else if src && !failed}
	<!-- Their initial sits underneath, so the circle is never empty while the photo downloads. -->
	<span class="display relative grid shrink-0 place-items-center overflow-hidden rounded-full text-cocoa-950 shadow-[0_2px_0_0_var(--color-edge)]" style="width: {size}px; height: {size}px; background: {color}; font-size: {size * 0.45}px">
		<span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
		<img
			bind:this={img}
			src={sized}
			alt=""
			width={size}
			height={size}
			decoding="async"
			referrerpolicy="no-referrer"
			class="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 {loaded ? 'opacity-100' : 'opacity-0'}"
			onload={() => (loaded = true)}
			onerror={() => (failed = true)}
		/>
	</span>
{:else}
	<span class="display relative grid shrink-0 place-items-center rounded-full text-cocoa-950 shadow-[0_2px_0_0_var(--color-edge)]" style="width: {size}px; height: {size}px; background: {color}; font-size: {size * 0.45}px" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
{/if}
