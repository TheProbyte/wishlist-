<script lang="ts">
	import { paperFor } from '#lib/papers.ts';

	/** A short strip of the list's paper with a torn bottom edge, used at the top of list and share pages. */
	let { wrap, occasion, transitionName, class: cls = '' }: { wrap?: string | null; occasion?: string | null; transitionName?: string; class?: string } = $props();
	const paper = $derived(paperFor(wrap, occasion));

	// Zig-zag tear along the bottom edge.
	const TEETH = 48;
	const tear = (() => {
		const pts = ['0 0', '100% 0'];
		for (let i = TEETH; i >= 0; i--) pts.push(`${((i / TEETH) * 100).toFixed(3)}% ${i % 2 ? 'calc(100% - 7px)' : '100%'}`);
		return `polygon(${pts.join(', ')})`;
	})();
</script>

<div class="relative h-20 overflow-hidden rounded-t-[var(--radius-card)] sm:h-24 {cls}" style="background: {paper.background}; clip-path: {tear};{transitionName ? ` view-transition-name: ${transitionName}` : ''}" aria-hidden="true">
	<div class="absolute inset-y-0 right-[14%] w-4" style="background: {paper.ribbon}"></div>
</div>
