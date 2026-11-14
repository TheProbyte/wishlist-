<script lang="ts">
	import Present from './Present.svelte';
	import Icon from './Icon.svelte';
	import { INKS, INK_NAMES, PAPERS, PATTERNS, makeCustom, paperFor, readCustom, type CustomPaper, type Ink, type Pattern } from '#lib/papers.ts';

	/**
	 * Pick a wrapping paper: one of the ready-made ones, or your own (a pattern, two colours and
	 * a ribbon, with a live preview). `value` is the paper's id or its custom code.
	 */
	let { value = $bindable(), name, onpick }: { value: string; name?: string; onpick?: (v: string) => void } = $props();

	const custom = $derived(readCustom(value));
	// What the designer starts from (and keeps, if you flip back and forth).
	// svelte-ignore state_referenced_locally
	let draft = $state<CustomPaper>(readCustom(value) ?? { pattern: 'dots', ground: 'teal', ink: 'cream', ribbon: 'mustard' });

	function pick(v: string) {
		value = v;
		onpick?.(v);
	}
	function set<K extends keyof CustomPaper>(key: K, v: CustomPaper[K]) {
		draft = { ...draft, [key]: v };
		pick(makeCustom(draft));
	}
	const inks = Object.keys(INKS) as Ink[];
	const patterns = Object.keys(PATTERNS) as Pattern[];
</script>

{#if name}<input type="hidden" {name} {value} />{/if}
<div class="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
	{#each PAPERS as p (p.id)}
		<button type="button" class="group flex flex-col items-center gap-1.5 text-[11px] font-bold {value === p.id ? 'text-fg' : 'text-fg-faint'}" aria-pressed={value === p.id} onclick={() => pick(p.id)}>
			<Present wrap={p.id} bow={false} ribbonAt={60} class="h-14 w-full rounded-[12px] ring-3 transition {value === p.id ? 'ring-mustard-400' : 'ring-transparent group-hover:ring-cocoa-600'}" />
			{p.name}
		</button>
	{/each}
	<button type="button" class="group flex flex-col items-center gap-1.5 text-[11px] font-bold {custom ? 'text-fg' : 'text-fg-faint'}" aria-pressed={!!custom} onclick={() => pick(makeCustom(draft))}>
		<span class="grid h-14 w-full place-items-center rounded-[12px] border-2 border-dashed ring-3 transition {custom ? 'border-transparent ring-mustard-400' : 'border-cocoa-600 ring-transparent group-hover:border-mustard-400'}" style={custom ? `background: ${paperFor(value).background}` : ''}>
			{#if !custom}<Icon name="palette" size={22} />{/if}
		</span>
		Your own
	</button>
</div>

{#if custom}
	<!-- The designer: pattern, colours, ribbon, with the present updating as you go. -->
	<div class="rise mt-4 rounded-[var(--radius-card)] bg-cocoa-850 p-4">
		<div class="flex gap-4">
			<Present wrap={value} ribbonAt={55} class="paper-grain h-24 w-28 shrink-0 rounded-[14px] shadow-[inset_0_-6px_0_rgb(0_0_0/0.12)]" />
			<div class="min-w-0 flex-1">
				<span class="label">Pattern</span>
				<div class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" data-no-swipe data-no-drag>
					{#each patterns as pt (pt)}
						<button
							type="button"
							class="h-10 w-10 shrink-0 rounded-[10px] ring-3 transition {draft.pattern === pt ? 'ring-mustard-400' : 'ring-transparent hover:ring-cocoa-600'}"
							style="background: {PATTERNS[pt].make(INKS[draft.ground], INKS[draft.ink])}"
							aria-label="Pattern: {PATTERNS[pt].name}"
							aria-pressed={draft.pattern === pt}
							onclick={() => set('pattern', pt)}
						></button>
					{/each}
				</div>
			</div>
		</div>
		{#each [['ground', 'Paper'], ['ink', 'Pattern colour'], ['ribbon', 'Ribbon']] as [key, label] (key)}
			<span class="label mt-3">{label}</span>
			<div class="flex flex-wrap gap-2">
				{#each inks as ink (ink)}
					{@const on = draft[key as 'ground' | 'ink' | 'ribbon'] === ink}
					<button
						type="button"
						class="h-9 w-9 rounded-full ring-3 ring-offset-2 ring-offset-cocoa-850 transition {on ? 'ring-mustard-400' : 'ring-transparent hover:ring-cocoa-600'}"
						style="background: {INKS[ink]}; box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.25)"
						aria-label="{label}: {INK_NAMES[ink]}"
						aria-pressed={on}
						onclick={() => set(key as 'ground' | 'ink' | 'ribbon', ink)}
					></button>
				{/each}
			</div>
		{/each}
	</div>
{/if}
