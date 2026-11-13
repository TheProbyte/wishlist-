<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from './Icon.svelte';

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
			class="absolute inset-0 cursor-default bg-[#120b07]/80"
			transition:fade={{ duration: 150 }}
			onclick={() => (open = false)}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-cocoa-900 shadow-[0_-3px_0_0_var(--color-cocoa-700)] sm:rounded-[24px] sm:shadow-[0_4px_0_0_var(--color-edge)] {wide
				? 'sm:max-w-3xl'
				: 'sm:max-w-lg'}"
			transition:fly={{ y: 24, duration: 200 }}
		>
			{#if title}
				<div class="flex items-center justify-between px-5 pt-5 pb-3 sm:px-6">
					<h2 class="text-lg font-bold">{title}</h2>
					<button type="button" class="btn-quiet -mr-2 w-11 px-0" aria-label="Close" onclick={() => (open = false)}>
						<Icon name="close" size={20} />
					</button>
				</div>
			{/if}
			<div class="overflow-y-auto px-5 py-5 sm:px-6">
				{@render children()}
			</div>
			{#if footer}
				<div class="bg-cocoa-900 px-5 py-4 shadow-[0_-2px_0_0_var(--color-cocoa-800)] sm:px-6">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
