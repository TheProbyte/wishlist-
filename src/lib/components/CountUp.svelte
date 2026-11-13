<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from '#lib/motion.ts';

	/** A number that counts up from 0 once, when the page loads. */
	let { value, duration = 900 }: { value: number; duration?: number } = $props();
	// svelte-ignore state_referenced_locally
	let shown = $state(value);

	onMount(() => {
		if (prefersReducedMotion() || value <= 0) return;
		const start = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			const p = Math.min(1, (now - start) / duration);
			shown = Math.round(value * (1 - Math.pow(1 - p, 3)));
			if (p < 1) frame = requestAnimationFrame(tick);
		};
		shown = 0;
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<span class="tabular-nums">{shown}</span>
