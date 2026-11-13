<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from './Icon.svelte';
	import { dur } from '#lib/motion.ts';

	/** A bottom sheet on phones (drag it down to close), a centred dialog on bigger screens. */
	let {
		open = $bindable(false),
		title,
		wide = false,
		children,
		footer
	}: { open?: boolean; title?: string; wide?: boolean; children: Snippet; footer?: Snippet } = $props();

	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}

	// Drag-to-close, from the grab handle and title row.
	let dragY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startT = 0;
	const isPhone = () => typeof window !== 'undefined' && window.innerWidth < 640;

	function down(e: PointerEvent) {
		if (!isPhone() || (e.target as HTMLElement).closest('button')) return;
		dragging = true;
		startY = e.clientY;
		startT = performance.now();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const dy = e.clientY - startY;
		// Resist dragging up; follow the finger down.
		dragY = dy > 0 ? dy : dy / 6;
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		const fast = dragY / Math.max(1, performance.now() - startT) > 0.6;
		if (dragY > 110 || (fast && dragY > 40)) open = false;
		dragY = 0;
	}
	$effect(() => {
		if (open) dragY = 0;
	});
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
		<button
			type="button"
			aria-label="Close"
			class="absolute inset-0 cursor-default bg-[#120b07]/80"
			style="opacity: {Math.max(0.3, 1 - dragY / 400)}"
			transition:fade={{ duration: dur(160) }}
			onclick={() => (open = false)}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-cocoa-900 shadow-[0_-3px_0_0_var(--color-cocoa-700)] sm:rounded-[24px] sm:shadow-[0_4px_0_0_var(--color-edge)] {wide
				? 'sm:max-w-3xl'
				: 'sm:max-w-lg'} {dragging ? '' : 'transition-transform duration-300 ease-[var(--ease-spring)]'}"
			style="transform: translateY({dragY}px)"
			transition:fly={{ y: isPhone() ? 320 : 24, duration: dur(isPhone() ? 300 : 200), easing: cubicOut, opacity: isPhone() ? 1 : 0 }}
		>
			<div class="touch-none select-none" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
				<div class="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-cocoa-600 sm:hidden" aria-hidden="true"></div>
				{#if title}
					<div class="flex items-center justify-between px-5 pt-3 pb-3 sm:px-6 sm:pt-5">
						<h2 class="text-lg font-bold">{title}</h2>
						<button type="button" class="btn-quiet -mr-2 w-11 px-0" aria-label="Close" onclick={() => (open = false)}>
							<Icon name="close" size={20} />
						</button>
					</div>
				{/if}
			</div>
			<div class="overflow-y-auto px-5 py-5 sm:px-6">
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
