<script lang="ts">
	import type { Snippet } from 'svelte';
	import { paperFor } from '#lib/papers.ts';

	/** A list drawn as a wrapped present: its paper, a ribbon cross and a bow. */
	let {
		wrap,
		occasion,
		ribbonAt = 68,
		bow = true,
		transitionName,
		class: cls = '',
		children
	}: {
		wrap?: string | null;
		occasion?: string | null;
		ribbonAt?: number;
		bow?: boolean;
		/** Lets the browser morph this paper into the list page's paper strip when the list opens. */
		transitionName?: string;
		class?: string;
		children?: Snippet;
	} = $props();

	const paper = $derived(paperFor(wrap, occasion));
</script>

<div class="relative overflow-hidden {cls}" style="background: {paper.background};{transitionName ? ` view-transition-name: ${transitionName}` : ''}">
	<div class="absolute inset-y-0 w-3.5" style="left: calc({ribbonAt}% - 7px); background: {paper.ribbon}"></div>
	<div class="absolute inset-x-0 top-[42%] h-3.5" style="background: {paper.ribbon}"></div>
	{#if bow}
		<!-- A big, flat bow with a dark outline so it reads on any paper. -->
		<svg class="bow absolute" style="left: calc({ribbonAt}% - 34px); top: calc(42% - 30px)" width="68" height="52" viewBox="0 0 68 52" aria-hidden="true">
			<g stroke="#2B1D14" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
				<path d="M31 31l-11 18 7-1 3 5 6-18z" fill={paper.ribbon} />
				<path d="M37 31l11 18-7-1-3 5-6-18z" fill={paper.ribbon} />
				<path d="M34 30C26 12 6 5 5 18c-1 12 17 14 29 12z" fill={paper.ribbon} />
				<path d="M34 30C42 12 62 5 63 18c1 12-17 14-29 12z" fill={paper.ribbon} />
				<path d="M34 30C28 20 15 16 14 20.5S26 29 34 30zM34 30c6-10 19-14 20-9.5S42 29 34 30z" fill={paper.bow} stroke="none" opacity="0.7" />
				<rect x="27" y="23" width="14" height="14" rx="5" fill={paper.ribbon} />
			</g>
		</svg>
	{/if}
	{@render children?.()}
</div>
