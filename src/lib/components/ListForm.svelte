<script lang="ts">
	import { OCCASIONS } from '#lib/format.ts';
	import type { Occasion } from '#lib/types.ts';

	let {
		name = '',
		occasion = 'birthday',
		date = '',
		description,
		showDescription = false
	}: { name?: string; occasion?: Occasion; date?: string; description?: string | null; showDescription?: boolean } = $props();

	// The form starts from the props and is then owned by the person typing.
	// svelte-ignore state_referenced_locally
	let picked = $state<Occasion>(occasion);
	// svelte-ignore state_referenced_locally
	let listName = $state(name);
	// svelte-ignore state_referenced_locally
	let touchedName = $state(Boolean(name));

	// Suggest a name from the occasion until the person types their own.
	function suggest(o: Occasion) {
		if (touchedName) return;
		const year = new Date().getFullYear();
		const label = OCCASIONS.find((x) => x.value === o)?.label ?? '';
		listName = o === 'general' ? 'Wish list' : o === 'other' ? '' : `${label} ${year}`;
	}
	$effect.pre(() => {
		if (!name) suggest(picked);
	});
</script>

<div class="space-y-5">
	<div>
		<span class="label">Occasion</span>
		<input type="hidden" name="occasion" value={picked} />
		<div class="flex flex-wrap gap-2">
			{#each OCCASIONS as o (o.value)}
				<button
					type="button"
					class="chip {picked === o.value ? 'chip-on' : 'hover:text-fg'}"
					onclick={() => {
						picked = o.value;
						suggest(o.value);
					}}
				>
					<span>{o.icon}</span>{o.label}
				</button>
			{/each}
		</div>
	</div>
	<div class="grid gap-4 sm:grid-cols-[1fr_11rem]">
		<label class="block">
			<span class="label">Name</span>
			<input
				class="field"
				name="name"
				required
				maxlength="80"
				placeholder="e.g. Birthday 2027"
				bind:value={listName}
				oninput={() => (touchedName = true)}
			/>
		</label>
		<label class="block">
			<span class="label">Date <span class="normal-case text-fg-faint">(optional)</span></span>
			<input class="field" type="date" name="occasion_date" value={date} />
		</label>
	</div>
	{#if showDescription}
		<label class="block">
			<span class="label">Note for givers <span class="normal-case text-fg-faint">(optional)</span></span>
			<textarea class="field min-h-20" name="description" maxlength="500" placeholder="Sizes, favourite colours, things I already have…"
				>{description ?? ''}</textarea
			>
		</label>
	{/if}
</div>
