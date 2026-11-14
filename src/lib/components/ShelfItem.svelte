<script lang="ts">
	import Present from './Present.svelte';
	import GiftTag from './GiftTag.svelte';
	import { openPresent } from '#lib/openPresent.ts';

	/**
	 * A present standing on a wooden shelf: the list's paper, its count tag, and its name on the
	 * shelf's edge below. Boxes come in a few shapes so a full shelf looks hand-stacked.
	 * `big` is the Everything list: twice as wide, always first.
	 */
	let {
		href,
		wrap,
		occasion,
		title,
		sub,
		count,
		big = false,
		index = 0,
		transitionName,
		subClass = ''
	}: {
		href: string;
		wrap: string | null;
		occasion: string;
		title: string;
		sub: string;
		count: number;
		big?: boolean;
		index?: number;
		transitionName?: string;
		subClass?: string;
	} = $props();

	// Assorted box shapes, by position, so neighbours differ.
	const SHAPES = ['aspect-[4/3] w-[86%]', 'aspect-square w-[74%]', 'aspect-[5/4] w-[82%]', 'aspect-[6/5] w-[70%]'];
	let box = $state<HTMLDivElement>();
	let link = $state<HTMLAnchorElement>();
	// Listen on the link itself, so this runs (and can take over) before the app's router,
	// which picks up link clicks further up the page.
	$effect(() => {
		const el = link;
		if (!el) return;
		el.addEventListener('click', open);
		return () => el.removeEventListener('click', open);
	});
	function open(e: MouseEvent) {
		// Let new-tab and similar clicks behave normally.
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const present = box?.firstElementChild as HTMLElement | null;
		if (!present) return;
		e.preventDefault();
		openPresent(present, href);
	}
	const shape = $derived(big ? 'aspect-[2.7/1] w-[92%]' : SHAPES[index % SHAPES.length]);
</script>

<a {href} bind:this={link} class="group rise flex flex-col justify-end {big ? 'col-span-2' : ''}" style="--i: {index}">
	<div bind:this={box} class="relative mx-auto {shape} transition-transform duration-200 ease-[var(--ease-spring)] group-hover:-translate-y-1.5 group-active:translate-y-0.5">
		<Present
			{wrap}
			{occasion}
			ribbonAt={big ? 50 : 62}
			{transitionName}
			class="paper-grain h-full w-full rounded-[12px] shadow-[inset_0_-6px_0_rgb(0_0_0/0.12)]"
		>
			<GiftTag tilt={-6} class="absolute bottom-2.5 left-2.5 z-10">{count} {count === 1 ? 'gift' : 'gifts'}</GiftTag>
		</Present>
	</div>
	<div class="shelf-plank" aria-hidden="true"></div>
	<div class="px-1 pt-2.5">
		<p class="truncate {big ? 'display text-[22px] leading-tight' : 'text-[15px] font-bold'}">{title}</p>
		<p class="truncate text-[13px] text-fg-muted {subClass}">{sub || ' '}</p>
	</div>
</a>
