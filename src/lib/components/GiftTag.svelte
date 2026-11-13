<script lang="ts">
	import type { Snippet } from 'svelte';

	/** The gift-tag shape: a pointed end with a punched hole. Used for counts, countdowns and prices. */
	let {
		tone = 'cream',
		tilt = 0,
		class: cls = '',
		children
	}: { tone?: 'cream' | 'mustard' | 'rust' | 'teal'; tilt?: number; class?: string; children: Snippet } = $props();

	const tones = {
		cream: 'bg-cream text-cocoa-950',
		mustard: 'bg-mustard-400 text-cocoa-950',
		rust: 'bg-rust-500 text-cream',
		teal: 'bg-teal-600 text-cream'
	};
</script>

<span class="inline-flex drop-shadow-[0_2px_0_var(--color-edge)] {cls}" style="transform: rotate({tilt}deg)">
	<span
		class="relative inline-flex items-center gap-1.5 py-1 pr-3 pl-6 text-xs leading-tight font-bold {tones[tone]}"
		style="clip-path: polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%); border-radius: 0 8px 8px 0"
	>
		<span class="absolute top-1/2 left-[9px] h-2 w-2 -translate-y-1/2 rounded-full bg-cocoa-950/80"></span>
		{@render children()}
	</span>
</span>
