<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from './Icon.svelte';
	import { undoStrip, stripAction, dismissStrip } from '#lib/undo.svelte.ts';
	import { dur } from '#lib/motion.ts';

	/** The strip at the bottom after deleting something: what happened, and Undo. A ribbon under
	 *  it runs down while there's still time. */
</script>

{#if undoStrip.id}
	{#key undoStrip.id}
		<div
			class="pointer-events-none fixed inset-x-0 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 sm:bottom-6"
			in:fly|global={{ y: 24, duration: dur(220), easing: cubicOut }}
			out:fly|global={{ y: 16, duration: dur(160) }}
		>
			<div class="pointer-events-auto relative flex w-full max-w-md items-center gap-2 overflow-hidden rounded-[16px] bg-cream py-1.5 pr-1.5 pl-4 text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge),0_14px_34px_-10px_rgb(0_0_0/0.7)]" role="status">
				<span class="min-w-0 flex-1 truncate text-sm font-bold">{undoStrip.message}</span>
				{#if undoStrip.action}
					<button class="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-cocoa-950 px-3.5 text-sm font-bold text-cream active:scale-95" onclick={stripAction}>
						<Icon name={undoStrip.kind === 'undo' ? 'chevron-left' : 'plus'} size={16} />{undoStrip.action}
					</button>
				{/if}
				<button class="grid h-10 w-8 place-items-center text-cocoa-950/60" aria-label="Done" onclick={dismissStrip}><Icon name="close" size={16} /></button>
				<span class="undo-ribbon stripes absolute inset-x-0 bottom-0 h-[4px] origin-left" style="animation-duration: {undoStrip.ms}ms" aria-hidden="true"></span>
			</div>
		</div>
	{/key}
{/if}
