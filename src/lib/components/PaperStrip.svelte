<script lang="ts">
	import { paperFor } from '#lib/papers.ts';

	/**
	 * A short strip of the list's paper with a torn edge. At the top of list and share pages it's
	 * the top half of the box (torn along the bottom); `bottom` makes it the other half, torn
	 * along the top, for the end of the list.
	 */
	let {
		wrap,
		occasion,
		transitionName,
		height = 'h-20 sm:h-24',
		bottom = false,
		class: cls = '',
		children
	}: { wrap?: string | null; occasion?: string | null; transitionName?: string; height?: string; bottom?: boolean; class?: string; children?: import('svelte').Snippet } = $props();
	const paper = $derived(paperFor(wrap, occasion));

	// Zig-zag tear along the bottom edge.
	const TEETH = 48;
	const tear = $derived.by(() => {
		if (bottom) {
			// The same teeth along the top, so the two halves would fit back together.
			const pts: string[] = [];
			for (let i = 0; i <= TEETH; i++) pts.push(`${((i / TEETH) * 100).toFixed(3)}% ${i % 2 ? '7px' : '0'}`);
			return `polygon(${[...pts, '100% 100%', '0 100%'].join(', ')})`;
		}
		const pts = ['0 0', '100% 0'];
		for (let i = TEETH; i >= 0; i--) pts.push(`${((i / TEETH) * 100).toFixed(3)}% ${i % 2 ? 'calc(100% - 7px)' : '100%'}`);
		return `polygon(${pts.join(', ')})`;
	});
</script>

<div class="relative overflow-hidden {bottom ? 'rounded-b-[var(--radius-card)] shadow-[inset_0_-6px_0_rgb(0_0_0/0.12)]' : 'rounded-t-[var(--radius-card)]'} {height} {cls}" style="background: {paper.background}; clip-path: {tear};{transitionName ? ` view-transition-name: ${transitionName}; view-transition-class: paper` : ''}" aria-hidden={children ? undefined : 'true'}>
	<div class="absolute inset-y-0 right-[14%] w-4" style="background: {paper.ribbon}"></div>
	{@render children?.()}
</div>
