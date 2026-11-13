<script lang="ts">
	/** 1–5 "how much I want it". Interactive when `onchange` is given or `name` is set (form field). */
	let {
		value = $bindable(0),
		name,
		size = 16,
		onchange
	}: { value?: number; name?: string; size?: number; onchange?: (v: number) => void } = $props();

	let hover = $state(0);
	const interactive = $derived(Boolean(onchange || name));
	const shown = $derived(hover || value);

	function pick(n: number) {
		value = value === n ? 0 : n;
		onchange?.(value);
	}
</script>

{#if name}<input type="hidden" {name} {value} />{/if}
<div
	class="inline-flex items-center gap-0.5"
	role={interactive ? 'radiogroup' : 'img'}
	aria-label={interactive ? 'How much you want it' : `${value} out of 5`}
	onmouseleave={() => (hover = 0)}
>
	{#each [1, 2, 3, 4, 5] as n (n)}
		{#if interactive}
			<button
				type="button"
				role="radio"
				aria-checked={value === n}
				aria-label={`${n} star${n > 1 ? 's' : ''}`}
				class="rounded p-0.5 transition hover:scale-110"
				onmouseenter={() => (hover = n)}
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					pick(n);
				}}
			>
				{@render star(n <= shown)}
			</button>
		{:else}
			<span class="p-px">{@render star(n <= shown)}</span>
		{/if}
	{/each}
</div>

{#snippet star(on: boolean)}
	<svg width={size} height={size} viewBox="0 0 20 20" class={on ? 'text-mustard-400' : 'text-cocoa-600'}>
		<path
			fill="currentColor"
			d="M10 1.8l2.47 5.18 5.68.7-4.19 3.9 1.1 5.62L10 14.44l-5.06 2.76 1.1-5.62L1.85 7.68l5.68-.7z"
		/>
	</svg>
{/snippet}
