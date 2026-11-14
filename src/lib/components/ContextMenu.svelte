<script lang="ts">
	import { fade } from 'svelte/transition';
	import { backOut, cubicIn, cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';
	import { menu, closeMenu, type MenuAction, type MenuItem, type MenuPapers } from '#lib/menu.svelte.ts';
	import { dur, prefersReducedMotion } from '#lib/motion.ts';

	/**
	 * The one menu on screen (see menu.svelte.ts): a small card next to the pointer, or, after a
	 * hold on a phone, just above the finger with the page dimmed behind it.
	 */

	let panel = $state<HTMLDivElement>();
	// The item waiting for its second tap.
	let armed = $state<number | null>(null);
	$effect(() => {
		if (menu.spec) armed = null;
	});

	const isAction = (i: MenuItem): i is MenuAction => typeof i === 'object' && 'label' in i;
	const isPapers = (i: MenuItem): i is MenuPapers => typeof i === 'object' && 'papers' in i;

	/** Where the menu goes, worked out from its real size in one go, before it's ever drawn, so
	 *  it appears in its place and never jumps. */
	function place(node: HTMLElement) {
		const w = node.offsetWidth; // forces layout; transforms (the pop) don't affect it
		const h = node.offsetHeight;
		const vw = innerWidth;
		const vh = innerHeight;
		const top0 = 8 + safeTop();
		const bottom0 = vh - 8 - (menu.touch ? 72 : 0);
		let left: number;
		let top: number;
		let origin: string;
		if (menu.touch) {
			// Above the finger if it fits, else below it; centred on it, kept on screen.
			left = clamp(menu.x - w / 2, 8, vw - w - 8);
			const above = menu.y - h - 18;
			const fitsAbove = above >= top0;
			top = fitsAbove ? above : clamp(menu.y + 18, top0, Math.max(top0, bottom0 - h));
			origin = `${menu.x - left}px ${fitsAbove ? '100%' : `${clamp(menu.y - top, 0, h)}px`}`;
		} else {
			// A mouse: from the pointer, flipping when near the right or bottom edge.
			const right = menu.x + w > vw - 8;
			const up = menu.y + h > bottom0;
			left = clamp(right ? menu.x - w : menu.x, 8, vw - w - 8);
			top = clamp(up ? menu.y - h : menu.y, top0, Math.max(top0, bottom0 - h));
			origin = `${right ? 'right' : 'left'} ${up ? 'bottom' : 'top'}`;
		}
		node.style.left = `${left}px`;
		node.style.top = `${top}px`;
		node.style.transformOrigin = origin;
		node.style.visibility = 'visible';
	}
	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
	// Below the phone's status bar (the header's own top padding, in the installed app).
	function safeTop() {
		const header = document.querySelector('header');
		return header ? parseFloat(getComputedStyle(header).paddingTop) || 0 : 0;
	}

	// In: it grows out of the finger (or pointer) with the slightest overshoot, and is solid
	// almost at once, so nothing half-there hangs about. Out: a quick shrink and fade.
	function pop(_node: HTMLElement) {
		if (prefersReducedMotion()) return { duration: 0 };
		return {
			duration: menu.touch ? 260 : 170,
			css: (t: number) => `opacity: ${Math.min(1, t * 3)}; transform: scale(${0.86 + 0.14 * backOut(t)})`
		};
	}
	function shrink(_node: HTMLElement) {
		if (prefersReducedMotion()) return { duration: 0 };
		return { duration: dur(130), easing: cubicIn, css: (t: number) => `opacity: ${t}; transform: scale(${0.95 + 0.05 * t})` };
	}

	async function choose(item: MenuAction, i: number) {
		if (item.confirm && armed !== i) {
			armed = i;
			return;
		}
		closeMenu();
		if (item.href) {
			if (item.external) open(item.href, '_blank', 'noopener');
			else await goto(item.href);
			return;
		}
		await item.run?.();
	}

	// Keyboard: arrows move between the choices, Escape closes.
	function onkeydown(e: KeyboardEvent) {
		if (!menu.spec) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			closeMenu();
			return;
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const buttons = [...(panel?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = e.key === 'ArrowDown' ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length;
		buttons[next]?.focus();
	}
	// Focus the first choice for keyboard users (mouse menus only, so phones don't scroll).
	$effect(() => {
		if (menu.spec && !menu.touch && panel) panel.focus({ preventScroll: true });
	});
</script>

<svelte:window {onkeydown} onresize={closeMenu} onscrollcapture={() => menu.spec && !menu.touch && closeMenu()} />

{#if menu.spec}
	{#key menu.spec}
	{@const spec = menu.spec}
	<div class="fixed inset-0 z-[90]" role="presentation">
		<button
			type="button"
			class="absolute inset-0 cursor-default {menu.touch ? 'bg-[#120b07]/50' : ''}"
			aria-label="Close menu"
			tabindex="-1"
			onclick={closeMenu}
			oncontextmenu={(e) => {
				e.preventDefault();
				// After a hold, the phone's own long-press signal can land here: that's not a request to close.
				if (!menu.touch) closeMenu();
			}}
			in:fade={{ duration: dur(220), easing: cubicOut }}
			out:fade={{ duration: dur(130) }}
		></button>
		<div
			bind:this={panel}
			use:place
			role="menu"
			tabindex="-1"
			aria-label={spec.title ?? 'Menu'}
			class="paper-grain absolute w-[min(16rem,calc(100vw-16px))] overflow-hidden rounded-[18px] bg-cocoa-900 p-1.5 shadow-[0_4px_0_0_var(--color-edge),0_18px_40px_-12px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700 outline-none select-none"
			style="left: 0; top: 0; visibility: hidden"
			in:pop
			out:shrink
		>
			{#if spec.title}
				<div class="px-3 pt-2 pb-2">
					<p class="truncate font-bold">{spec.title}</p>
					{#if spec.sub}<p class="truncate text-xs text-fg-faint">{spec.sub}</p>{/if}
				</div>
				<div class="stripes mx-2 mb-1 h-[4px] rounded-full opacity-80" aria-hidden="true"></div>
			{/if}
			{#each spec.items as item, i (i)}
				{#if item === 'divider'}
					<div class="mx-3 my-1 h-0.5 rounded-full bg-cocoa-800" role="separator"></div>
				{:else if isPapers(item)}
					<div class="px-3 pt-1.5 pb-2.5">
						<p class="mb-2 text-xs font-bold text-fg-faint">Wrapping paper</p>
						<div class="grid grid-cols-7 gap-1.5">
							{#each item.papers as p (p.id)}
								<button
									type="button"
									role="menuitemradio"
									aria-checked={item.current === p.id}
									aria-label={p.name}
									title={p.name}
									class="aspect-square rounded-full shadow-[0_2px_0_0_var(--color-edge)] transition hover:scale-110 active:scale-95 {item.current === p.id ? 'ring-3 ring-[var(--accent)] ring-offset-2 ring-offset-cocoa-900' : 'ring-2 ring-cocoa-950/60'}"
									style="background: {p.background}"
									onclick={() => {
										closeMenu();
										item.pick(p.id);
									}}
								></button>
							{/each}
						</div>
					</div>
				{:else if isAction(item)}
					<button
						type="button"
						role="menuitem"
						class="flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-bold transition outline-none focus-visible:bg-cocoa-800 {armed === i
							? 'bg-rust-500 text-cream'
							: item.danger
								? 'text-rust-300 hover:bg-rust-500/15'
								: 'text-fg hover:bg-cocoa-800'}"
						onclick={() => choose(item, i)}
					>
						{#if item.icon}<Icon name={item.icon} size={18} />{/if}
						<span class="min-w-0 flex-1 truncate">{armed === i ? item.confirm : item.label}</span>
						{#if item.external}<Icon name="external" size={14} />{:else if item.hint}<span class="text-xs font-bold text-fg-faint">{item.hint}</span>{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>
{/key}
{/if}
