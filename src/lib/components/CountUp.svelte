<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from '#lib/motion.ts';

	/** A number that counts up once, when it first shows: from 0, or from `from`. */
	let { value, from = 0, duration = 900 }: { value: number; from?: number; duration?: number } = $props();
	// svelte-ignore state_referenced_locally
	let shown = $state(value);

	onMount(() => {
		if (prefersReducedMotion() || value <= from) return;
		const start = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			const p = Math.min(1, (now - start) / duration);
			shown = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3)));
			if (p < 1) frame = requestAnimationFrame(tick);
		};
		shown = from;
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<span class="tabular-nums">{shown}</span>
