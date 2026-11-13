<script lang="ts">
	import Icon from './Icon.svelte';
	import { OCCASIONS } from '#lib/format.ts';
	import { PAPERS, defaultPaperId } from '#lib/papers.ts';
	import type { Occasion } from '#lib/types.ts';

	let {
		name = '',
		occasion = 'birthday',
		date = '',
		wrap = null,
		description,
		showDescription = false
	}: {
		name?: string;
		occasion?: Occasion;
		date?: string;
		wrap?: string | null;
		description?: string | null;
		showDescription?: boolean;
	} = $props();

	// The form starts from the props and is then owned by the person typing.
	// svelte-ignore state_referenced_locally
	let picked = $state<Occasion>(occasion);
	// svelte-ignore state_referenced_locally
	let listName = $state(name);
	// svelte-ignore state_referenced_locally
	let touchedName = $state(Boolean(name));
	// svelte-ignore state_referenced_locally
	let paper = $state(wrap ?? defaultPaperId(occasion));
	// svelte-ignore state_referenced_locally
	let touchedPaper = $state(Boolean(wrap));

	function pickOccasion(o: Occasion) {
		picked = o;
		if (!touchedPaper) paper = defaultPaperId(o);
		if (touchedName) return;
		const year = new Date().getFullYear();
		const label = OCCASIONS.find((x) => x.value === o)?.label ?? '';
		listName = o === 'general' ? 'Wish list' : o === 'other' ? '' : `${label} ${year}`;
	}
	// svelte-ignore state_referenced_locally
	if (!name) pickOccasion(picked);
</script>

<div class="space-y-6">
	<div>
		<span class="label">Occasion</span>
		<input type="hidden" name="occasion" value={picked} />
		<div class="flex flex-wrap gap-2">
			{#each OCCASIONS as o (o.value)}
				<button type="button" class="chip {picked === o.value ? 'chip-on' : 'hover:text-fg'}" aria-pressed={picked === o.value} onclick={() => pickOccasion(o.value)}>
					<Icon name={o.icon} size={16} />{o.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-[1fr_11rem]">
		<label class="block">
			<span class="label">Name</span>
			<input class="field" name="name" required maxlength="80" placeholder="e.g. Birthday 2027" bind:value={listName} oninput={() => (touchedName = true)} />
		</label>
		<label class="block">
			<span class="label">Date <span class="normal-case text-fg-faint">(optional)</span></span>
			<input class="field" type="date" name="occasion_date" value={date} />
		</label>
	</div>

	<div>
		<span class="label">Wrapping paper</span>
		<input type="hidden" name="wrap" value={paper} />
		<div class="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
			{#each PAPERS as p (p.id)}
				<button
					type="button"
					class="group flex flex-col items-center gap-1.5 text-[11px] font-bold {paper === p.id ? 'text-fg' : 'text-fg-faint'}"
					aria-pressed={paper === p.id}
					onclick={() => {
						paper = p.id;
						touchedPaper = true;
					}}
				>
					<span
						class="relative block h-14 w-full overflow-hidden rounded-xl transition {paper === p.id ? 'ring-3 ring-mustard-400 ring-offset-2 ring-offset-cocoa-900' : 'group-hover:-translate-y-0.5'}"
						style="background: {p.background}"
					>
						<span class="absolute inset-y-0 left-[64%] w-2" style="background: {p.ribbon}"></span>
					</span>
					{p.name}
				</button>
			{/each}
		</div>
	</div>

	{#if showDescription}
		<label class="block">
			<span class="label">Note for givers <span class="normal-case text-fg-faint">(optional)</span></span>
			<textarea class="field min-h-20" name="description" maxlength="500" placeholder="Sizes, favourite colours, things I already have…">{description ?? ''}</textarea>
		</label>
	{/if}
</div>
