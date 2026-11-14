<script lang="ts">
	/** 1–5 hearts: "how much I want it". Interactive when `onchange` is given or `name` is set (form field). */
	let {
		value = $bindable(0),
		name,
		size = 16,
		onchange
	}: { value?: number; name?: string; size?: number; onchange?: (v: number) => void } = $props();

	let hover = $state(0);
	const interactive = $derived(Boolean(onchange || name));
	const shown = $derived(hover || value);

	// Bumped on every pick so the stars re-run their fill-and-pop animation.
	let popped = $state(0);

	function pick(n: number) {
		value = value === n ? 0 : n;
		popped++;
		onchange?.(value);
	}
</script>

{#if name}<input type="hidden" {name} {value} />{/if}
<div
	class="inline-flex items-center gap-0.5"
	role={interactive ? 'radiogroup' : 'img'}
	aria-label={interactive ? 'How much you want it' : `${value} of 5 hearts`}
	onmouseleave={() => (hover = 0)}
>
	{#each [1, 2, 3, 4, 5] as n (n)}
		{#if interactive}
			<button
				type="button"
				role="radio"
				aria-checked={value === n}
				aria-label={`${n} heart${n > 1 ? 's' : ''}`}
				class="rounded p-0.5 transition hover:scale-110"
				onmouseenter={() => (hover = n)}
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					pick(n);
				}}
			>
				{#key popped}
					<span class="block {popped && n <= value ? 'pop' : ''}" style="animation-delay: {(n - 1) * 45}ms">{@render star(n <= shown)}</span>
				{/key}
			</button>
		{:else}
			<span class="p-px">{@render star(n <= shown)}</span>
		{/if}
	{/each}
</div>

{#snippet star(on: boolean)}
	<svg width={size} height={size} viewBox="0 0 20 20" class="transition-colors {on ? 'text-rust-500' : 'text-cocoa-600'}">
		<path
			fill="currentColor"
			d="M10 17.6l-1.2-1.08C4.5 12.66 1.7 10.12 1.7 6.98A4.32 4.32 0 0 1 6.07 2.6c1.48 0 2.9.69 3.93 1.78A5.37 5.37 0 0 1 13.93 2.6a4.32 4.32 0 0 1 4.37 4.38c0 3.14-2.8 5.68-7.1 9.55z"
		/>
	</svg>
{/snippet}
