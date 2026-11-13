<script lang="ts">
	import Present from './Present.svelte';
	import GiftTag from './GiftTag.svelte';
	import Icon from './Icon.svelte';
	import { countdownLabel, daysUntil, formatDate, occasionMeta } from '#lib/format.ts';

	/** An occasion list drawn as a wrapped present. */
	let {
		list,
		index = 0
	}: { list: { id: string; name: string; wrap: string | null; occasion: string; item_count: number; next_date: string | null }; index?: number } = $props();
	const meta = $derived(occasionMeta(list.occasion));
	const days = $derived(daysUntil(list.next_date));
	const soon = $derived(days != null && days >= 0 && days <= 60);
</script>

<a href="/lists/{list.id}" class="card group rise flex flex-col overflow-hidden transition active:translate-y-0.5" style="--i: {index + 1}">
	<Present wrap={list.wrap} occasion={list.occasion} transitionName="paper-{list.id}" class="aspect-[4/3] rounded-t-[var(--radius-card)]">
		<GiftTag tilt={-6} class="absolute bottom-3 left-3">{list.item_count} {list.item_count === 1 ? 'gift' : 'gifts'}</GiftTag>
	</Present>
	<div class="flex flex-1 flex-col gap-0.5 px-3.5 pt-3 pb-3.5">
		<h3 class="truncate text-[15px] font-bold">{list.name}</h3>
		<p class="flex items-center gap-1.5 truncate text-[13px] text-fg-muted">
			<Icon name={meta.icon} size={14} />
			{#if list.next_date}
				<span class={soon ? 'font-bold text-rust-300' : ''}>{soon ? countdownLabel(list.next_date) : formatDate(list.next_date)}</span>
			{:else}
				{meta.label}
			{/if}
		</p>
	</div>
</a>
