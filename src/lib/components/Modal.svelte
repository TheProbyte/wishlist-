<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from './Icon.svelte';
	import { dur, prefersReducedMotion } from '#lib/motion.ts';

	/**
	 * A bottom sheet on phones, a centred dialog on bigger screens.
	 *
	 * On a phone the whole sheet can be dragged: pull it down from anywhere (once its content is
	 * scrolled to the top) and it follows your finger, then either springs back or carries on
	 * down and away from where you let go. `expandable` sheets open part-way up; drag them up to
	 * see everything.
	 */
	let {
		open = $bindable(false),
		title,
		wide = false,
		expandable = false,
		children,
		footer,
		header
	}: { open?: boolean; title?: string; wide?: boolean; expandable?: boolean; children: Snippet; footer?: Snippet; header?: Snippet } = $props();

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}

	const isPhone = () => typeof window !== 'undefined' && window.innerWidth < 640;

	let sheet = $state<HTMLDivElement>();
	let body = $state<HTMLDivElement>();
	// How far the sheet is pulled down (px), and how far an expandable one is pulled up.
	let dragY = $state(0);
	let lift = $state(0);
	let dragging = $state(false);
	let expanded = $state(false);

	$effect(() => {
		if (open) {
			dragY = 0;
			lift = 0;
			expanded = false;
		}
	});

	/* ---------------------------------------------------------------- dragging */

	let startX = 0;
	let startY = 0;
	let lastY = 0;
	let lastT = 0;
	let velocity = 0; // px per ms, positive = downwards
	let mode: 'undecided' | 'sheet' | 'scroll' = 'undecided';

	function begin(x: number, y: number) {
		startX = x;
		startY = lastY = y;
		lastT = performance.now();
		velocity = 0;
		mode = 'undecided';
	}

	/** Returns true while the sheet (not the content) is following the finger. */
	function follow(x: number, y: number, target: EventTarget | null): boolean {
		const dy = y - startY;
		const dx = x - startX;
		if (mode === 'undecided') {
			if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return false;
			const vertical = Math.abs(dy) > Math.abs(dx);
			const atTop = (body?.scrollTop ?? 0) <= 0;
			const el = target as HTMLElement | null;
			const exempt = el?.closest?.('input[type=range], [data-no-drag]');
			// Down with the content at its top closes; up on a part-way sheet opens it fully.
			const pull = vertical && !exempt && ((dy > 0 && atTop) || (dy < 0 && expandable && !expanded));
			mode = pull ? 'sheet' : 'scroll';
			if (pull) {
				dragging = true;
				startY = y; // no jump: start following from here
			}
		}
		if (mode !== 'sheet') return false;
		const now = performance.now();
		velocity = 0.8 * ((y - lastY) / Math.max(1, now - lastT)) + 0.2 * velocity;
		lastY = y;
		lastT = now;
		const d = y - startY;
		if (d >= 0) {
			dragY = d;
			lift = 0;
		} else {
			dragY = 0;
			// Up: an expandable sheet grows; anything else resists.
			lift = expandable && !expanded ? -d : 0;
			if (!expandable || expanded) dragY = d / 6;
		}
		return true;
	}

	function release() {
		if (mode !== 'sheet') return void (mode = 'undecided');
		mode = 'undecided';
		dragging = false;
		if (lift > 0) {
			if (lift > 60 || velocity < -0.4) expanded = true;
			lift = 0;
			return;
		}
		const h = sheet?.offsetHeight ?? 400;
		if (dragY > Math.min(140, h * 0.3) || (velocity > 0.5 && dragY > 30)) {
			open = false; // the out transition carries on from dragY
			return;
		}
		dragY = 0;
	}

	// Touch: from anywhere on the sheet.
	function touchstart(e: TouchEvent) {
		if (!isPhone() || e.touches.length !== 1) return;
		begin(e.touches[0].clientX, e.touches[0].clientY);
	}
	function touchmove(e: TouchEvent) {
		if (!isPhone() || e.touches.length !== 1) return;
		if (follow(e.touches[0].clientX, e.touches[0].clientY, e.target) && e.cancelable) e.preventDefault();
	}

	// Mouse (a narrow desktop window): from the handle and title.
	function pointerdown(e: PointerEvent) {
		if (e.pointerType === 'touch' || !isPhone() || (e.target as HTMLElement).closest('button')) return;
		begin(e.clientX, e.clientY);
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function pointermove(e: PointerEvent) {
		if (e.pointerType === 'touch' || !(e.buttons & 1)) return;
		follow(e.clientX, e.clientY, null);
	}
	function pointerup(e: PointerEvent) {
		if (e.pointerType !== 'touch') release();
	}

	$effect(() => {
		const el = sheet;
		if (!el) return;
		el.addEventListener('touchstart', touchstart, { passive: true });
		el.addEventListener('touchmove', touchmove, { passive: false });
		el.addEventListener('touchend', release);
		el.addEventListener('touchcancel', release);
		return () => {
			el.removeEventListener('touchstart', touchstart);
			el.removeEventListener('touchmove', touchmove);
			el.removeEventListener('touchend', release);
			el.removeEventListener('touchcancel', release);
		};
	});

	/* ---------------------------------------------------------------- coming and going */

	const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

	/** Phones: up from below the screen. Bigger screens: a short rise and fade. */
	function sheetIn(node: HTMLElement) {
		if (!isPhone()) return fly(node, { y: 24, duration: dur(200), easing: cubicOut });
		if (prefersReducedMotion()) return { duration: 0 };
		const h = node.offsetHeight + 24;
		return { duration: 320, easing: easeOut, css: (t: number) => `transform: translateY(${(1 - t) * h}px)` };
	}

	/** Down and away, carrying on from wherever the finger let go, a little faster if flicked. */
	function sheetOut(node: HTMLElement) {
		if (!isPhone()) return fly(node, { y: 24, duration: dur(160), easing: cubicOut });
		if (prefersReducedMotion()) return { duration: 0 };
		const from = dragY;
		const to = node.offsetHeight + 24;
		const fast = velocity > 0.8;
		return {
			duration: Math.round((fast ? 180 : 260) * Math.max(0.45, 1 - from / to)),
			easing: (t: number) => t,
			css: (_t: number, u: number) => `transform: translateY(${from + (to - from) * easeOut(u)}px)`
		};
	}

	// Phones: while the keyboard is up, the sheet lives exactly in the part of the screen you can
	// see (above the keyboard), so it doesn't jump as the phone scrolls, and Save stays in sight.
	// The field you're typing in is kept in view, never under the keyboard.
	let view = $state<{ top: number; height: number } | null>(null);
	$effect(() => {
		const vv = window.visualViewport;
		if (!open || !vv) return;
		// Only writes (never reads) the state, so this effect can't re-trigger itself.
		const update = () => {
			const keyboard = innerHeight - vv.height - vv.offsetTop;
			view = keyboard > 80 ? { top: Math.round(vv.offsetTop), height: Math.round(vv.height) } : null;
		};
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
			untrack(() => (view = null));
		};
	});
	function keepInView(e: FocusEvent) {
		const el = e.target as HTMLElement;
		if (!el.matches?.('input, textarea, select')) return;
		// After the keyboard has finished coming up.
		setTimeout(() => el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }), 320);
	}

	// How tall the sheet may be: part-way for an expandable one until it's opened up.
	const maxHeight = $derived(
		view ? `${view.height * 0.96}px` : expandable && !expanded ? `calc(64dvh + ${lift}px)` : '92dvh'
	);
</script>

<svelte:window {onkeydown} />

{#if open}
	<div
		class="fixed inset-x-0 top-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
		style={view ? `top: ${view.top}px; height: ${view.height}px` : 'bottom: 0'}
	>
		<button
			type="button"
			aria-label="Close"
			class="absolute inset-0 cursor-default bg-[#120b07]/80"
			style="opacity: {Math.max(0.25, 1 - dragY / 500)}"
			transition:fade={{ duration: dur(220) }}
			onclick={() => (open = false)}
		></button>
		<div
			bind:this={sheet}
			onfocusin={keepInView}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative flex w-full flex-col overflow-hidden overscroll-contain rounded-t-[28px] bg-cocoa-900 shadow-[0_-3px_0_0_var(--color-cocoa-700)] sm:max-h-[92dvh]! sm:rounded-[24px] sm:shadow-[0_4px_0_0_var(--color-edge)] {wide
				? 'sm:max-w-3xl'
				: 'sm:max-w-lg'} {dragging ? '' : 'transition-[transform,max-height] duration-300 ease-[var(--ease-out-soft)]'}"
			style="transform: translateY({dragY}px); max-height: {view ? maxHeight : `min(${maxHeight}, calc(100dvh - 3rem))`}"
			in:sheetIn
			out:sheetOut
		>
			<div class="select-none" onpointerdown={pointerdown} onpointermove={pointermove} onpointerup={pointerup} onpointercancel={pointerup} role="presentation">
				<div class="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-cocoa-600 sm:hidden" aria-hidden="true"></div>
				{#if header}
					{@render header()}
				{:else if title}
					<div class="flex items-center justify-between px-5 pt-3 pb-3 sm:px-6 sm:pt-5">
						<h2 class="text-lg font-bold">{title}</h2>
						<button type="button" class="btn-quiet -mr-2 w-11 px-0" aria-label="Close" onclick={() => (open = false)}>
							<Icon name="close" size={20} />
						</button>
					</div>
				{/if}
			</div>
			<div bind:this={body} class="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
				{@render children()}
			</div>
			{#if footer}
				<div class="bg-cocoa-900 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-2px_0_0_var(--color-cocoa-800)] sm:px-6 sm:pb-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
