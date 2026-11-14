<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Round status stickers (#1, New, Taken), slightly rotated: the one "messy" thing allowed. */
	let {
		tone = 'cream',
		tilt = -4,
		class: cls = '',
		children
	}: { tone?: 'cream' | 'mustard' | 'rust' | 'teal' | 'cocoa'; tilt?: number; class?: string; children: Snippet } = $props();

	const tones = {
		cream: 'bg-cream text-cocoa-950',
		mustard: 'bg-mustard-400 text-cocoa-950',
		rust: 'bg-rust-500 text-cream',
		teal: 'bg-teal-600 text-cream',
		cocoa: 'bg-cocoa-950 text-fg'
	};
</script>

<span
	class="sticker-peel {/\babsolute\b/.test(cls) ? '' : 'relative'} inline-flex min-h-7 min-w-7 items-center justify-center rounded-full px-2.5 py-1 text-xs leading-none font-bold whitespace-nowrap shadow-[0_2px_0_0_var(--color-edge)] {tones[tone]} {cls}"
	style="transform: rotate({tilt}deg)">{@render children()}</span
>
