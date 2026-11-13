<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

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
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
		<button
			type="button"
			aria-label="Close"
			class="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
			transition:fade={{ duration: 150 }}
			onclick={() => (open = false)}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink-700 bg-ink-900 shadow-[var(--shadow-pop)] sm:rounded-3xl {wide
				? 'sm:max-w-3xl'
				: 'sm:max-w-lg'}"
			transition:fly={{ y: 24, duration: 200 }}
		>
			{#if title}
				<div class="flex items-center justify-between border-b border-ink-700/70 px-5 py-4 sm:px-6">
					<h2 class="font-display text-lg font-semibold">{title}</h2>
					<button type="button" class="btn-quiet -mr-2 px-2" aria-label="Close" onclick={() => (open = false)}>
						<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
					</button>
				</div>
			{/if}
			<div class="overflow-y-auto px-5 py-5 sm:px-6">
				{@render children()}
			</div>
			{#if footer}
				<div class="border-t border-ink-700/70 bg-ink-900/95 px-5 py-4 sm:px-6">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
