<script lang="ts">
	import Icon from './Icon.svelte';
	import { OCCASIONS, dateRule, nextAnnual, formatDate, suggestedListName } from '#lib/format.ts';
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
		listName = suggestedListName(o);
	}
	const rule = $derived(dateRule(picked));
	const dateLabel = $derived(picked === 'birthday' ? 'Your birthday' : picked === 'anniversary' ? 'Anniversary date' : 'Date');
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

	<label class="block">
		<span class="label">Name</span>
		<input class="field" name="name" required maxlength="80" placeholder="e.g. My birthday" bind:value={listName} oninput={() => (touchedName = true)} />
	</label>

	{#if rule === 'fixed'}
		<p class="flex items-center gap-2.5 rounded-[var(--radius-control)] bg-cocoa-800 px-3.5 py-3 text-sm text-fg-muted">
			<Icon name="calendar" size={18} class="text-rust-300" />
			<span>Every year on <span class="font-bold text-fg">Dec 25</span>. Next one: {formatDate(nextAnnual(12, 25))}.</span>
		</p>
	{:else if rule !== 'none'}
		<label class="block">
			<span class="label">{dateLabel} {#if rule === 'once'}<span class="normal-case text-fg-faint">(optional)</span>{/if}</span>
			<input class="field sm:max-w-56" type="date" name="occasion_date" value={date} required={rule === 'yearly'} />
			{#if rule === 'yearly'}
				<span class="mt-1.5 block text-xs text-fg-faint">
					{picked === 'birthday' ? 'Your real birthday, with the year. Enter it once and it counts down to your next one every year.' : 'Enter it once. It counts down to the next one every year.'}
				</span>
			{/if}
		</label>
	{/if}

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
