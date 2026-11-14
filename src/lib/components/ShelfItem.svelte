<script lang="ts">
	import Present from './Present.svelte';
	import GiftTag from './GiftTag.svelte';
	import { openPresent } from '#lib/openPresent.ts';
	import { contextMenu, type MenuItem } from '#lib/menu.svelte.ts';

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
		subClass = '',
		days = null,
		menu = null
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
		/** Days until its occasion: inside a week, the present gets restless. */
		days?: number | null;
		/** Its options, shown when it's held or right-clicked (after "Open", which every list has). */
		menu?: (() => MenuItem[]) | null;
	} = $props();

	// Assorted box shapes, by position, so neighbours differ; fuller lists are bigger boxes.
	const SHAPES = [
		{ aspect: 'aspect-[4/3]', width: 86 },
		{ aspect: 'aspect-square', width: 74 },
		{ aspect: 'aspect-[5/4]', width: 82 },
		{ aspect: 'aspect-[6/5]', width: 70 }
	];
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
		openPresent(present, href, href.split('/').pop() ?? '');
	}
	const grow = $derived(count === 0 ? 0.86 : count < 3 ? 0.93 : count < 7 ? 1 : count < 15 ? 1.06 : 1.11);
	const shape = $derived(
		big ? { aspect: 'aspect-[2.7/1]', width: 92 } : { aspect: SHAPES[index % SHAPES.length].aspect, width: Math.min(96, Math.round(SHAPES[index % SHAPES.length].width * grow)) }
	);
	const restless = $derived(days != null && days >= 0 && days <= 7);
</script>

<a
	{href}
	bind:this={link}
	use:contextMenu={{
		spec: () => (menu ? { title, sub: `${count} ${count === 1 ? 'gift' : 'gifts'}`, items: [{ label: 'Open', icon: 'gift', run: () => link?.click() }, ...menu()] } : null)
	}}
	class="group rise flex flex-col justify-end {big ? 'col-span-2' : ''}" style="--i: {index}">
	<div
		bind:this={box}
		class="relative mx-auto {shape.aspect} {restless ? 'shelf-restless' : ''} transition-transform duration-200 ease-[var(--ease-spring)] group-hover:-translate-y-1.5 group-active:translate-y-0.5"
		style="width: {shape.width}%; --delay: {(index % 4) * 1.3}s"
	>
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
	<!-- Same height under every box, so the planks of a row line up. -->
	<div class="h-[58px] overflow-hidden px-1 pt-2.5">
		<p class="truncate {big ? 'display text-[22px] leading-tight' : 'text-[15px] font-bold'}">{title}</p>
		<p class="truncate text-[13px] text-fg-muted {subClass}">{sub || ' '}</p>
	</div>
</a>
