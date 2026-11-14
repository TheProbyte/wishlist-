<script lang="ts">
	/**
	 * Cardboard stand-ins for a page that's on its way: a header strip, a title, a toolbar and a
	 * grid of boxes, in the places the real ones will be, so nothing jumps when it arrives.
	 */
	let { kind = 'list' }: { kind?: 'list' | 'person' | 'rows' } = $props();
</script>

<div class="pointer-events-none" aria-busy="true" aria-label="Loading">
	{#if kind === 'rows'}
		<!-- A page of rows: back link, title, a line under it, then cards. -->
		<div class="cardboard -mt-1 h-5 w-20 rounded-full"></div>
		<div class="cardboard mt-4 h-10 w-2/3 max-w-xs rounded-[12px]"></div>
		<div class="cardboard mt-3 h-4 w-5/6 max-w-md rounded-full"></div>
		<div class="mt-7 grid gap-3 md:grid-cols-2">
			{#each Array.from({ length: 6 }) as _, i (i)}
				<div class="flex items-center gap-3 rounded-[var(--radius-card)] bg-cocoa-850 p-3 shadow-[0_3px_0_0_var(--color-edge)]" style="opacity: {1 - i * 0.1}">
					<div class="cardboard h-12 w-12 shrink-0 rounded-full brightness-125"></div>
					<div class="flex-1">
						<div class="cardboard h-3.5 w-1/2 rounded-full brightness-125"></div>
						<div class="cardboard mt-2 h-3 w-1/3 rounded-full brightness-125"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if kind === 'list'}
		<div class="cardboard -mt-3 h-[60px] rounded-t-[var(--radius-card)] sm:mt-0 sm:h-20"></div>
		<div class="cardboard mt-3 h-8 w-2/3 max-w-sm rounded-[10px]"></div>
		<div class="cardboard mt-2 h-4 w-40 rounded-full"></div>
		<div class="cardboard mt-5 h-14 rounded-[var(--radius-card)]"></div>
	{:else}
		<div class="flex items-center gap-3">
			<div class="cardboard h-12 w-12 rounded-full"></div>
			<div class="cardboard h-8 w-56 rounded-[10px]"></div>
		</div>
		<div class="mt-5 flex gap-2">
			{#each [0, 1, 2] as i (i)}<div class="cardboard h-9 w-24 rounded-full"></div>{/each}
		</div>
	{/if}
	{#if kind !== 'rows'}
	<div class="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
		{#each Array.from({ length: 8 }) as _, i (i)}
			<div class="overflow-hidden rounded-[var(--radius-card)] bg-cocoa-850 p-1.5 shadow-[0_3px_0_0_var(--color-edge)]" style="opacity: {1 - i * 0.07}">
				<div class="cardboard aspect-square rounded-[12px] brightness-125"></div>
				<div class="cardboard mx-1 mt-3 h-3.5 w-3/4 rounded-full brightness-125"></div>
				<div class="cardboard mx-1 mt-2 mb-2 h-3.5 w-1/3 rounded-full brightness-125"></div>
			</div>
		{/each}
	</div>
	{/if}
</div>
