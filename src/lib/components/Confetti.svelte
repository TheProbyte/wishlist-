<script lang="ts">
	import { prefersReducedMotion } from '#lib/motion.ts';

	/** A short burst of paper confetti in the five palette colours. Bump `fire` to launch one. */
	let { fire = 0 }: { fire?: number } = $props();

	const COLORS = ['#E8A83A', '#D2602D', '#3E8E87', '#F3E7CF', '#F3C56A'];
	type Piece = { id: number; style: string };
	let pieces = $state<Piece[]>([]);
	let seq = 0;

	$effect(() => {
		if (!fire || prefersReducedMotion()) return;
		const burst: Piece[] = Array.from({ length: 28 }, (_, i) => {
			const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.4;
			const power = 70 + Math.random() * 90;
			const dx = Math.cos(angle) * power;
			const dy = Math.sin(angle) * power - 70;
			const w = 6 + Math.random() * 6;
			return {
				id: ++seq,
				style: `--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;background:${COLORS[i % COLORS.length]};width:${w.toFixed(0)}px;height:${(w * 0.55).toFixed(0)}px;animation-delay:${(Math.random() * 60).toFixed(0)}ms`
			};
		});
		pieces = burst;
		const timer = setTimeout(() => (pieces = []), 1400);
		return () => clearTimeout(timer);
	});
</script>

{#if pieces.length}
	<div class="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-visible" aria-hidden="true">
		{#each pieces as p (p.id)}
			<span class="confetti absolute rounded-[2px]" style={p.style}></span>
		{/each}
	</div>
{/if}
