<script lang="ts">
	import Present from './Present.svelte';
	import GiftTag from './GiftTag.svelte';
	import Icon from './Icon.svelte';

	/** The Everything list: every gift someone wants, as the big present at the top. */
	let {
		id,
		count,
		wrap,
		title = 'Everything',
		subtitle = 'Every gift you’d love, in one list',
		compact = false
	}: { id: string; count: number; wrap: string | null; title?: string; subtitle?: string; compact?: boolean } = $props();
</script>

<a href="/lists/{id}" class="card group rise flex overflow-hidden transition active:translate-y-0.5 {compact ? '' : 'sm:min-h-44'}">
	<Present wrap={wrap ?? 'sunburst'} occasion="general" ribbonAt={50} transitionName="paper-{id}" class="w-[34%] shrink-0 rounded-l-[var(--radius-card)] sm:w-72" />
	<div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4 sm:p-6">
		<p class="text-xs font-bold tracking-wider text-mustard-400 uppercase">Wish list</p>
		<h2 class="display {compact ? 'text-2xl' : 'text-[28px] sm:text-4xl'} leading-tight">{title}</h2>
		<p class="text-sm text-fg-muted">{subtitle}</p>
		<div class="mt-1.5 flex items-center gap-3">
			<GiftTag tone="mustard">{count} {count === 1 ? 'gift' : 'gifts'}</GiftTag>
			<span class="inline-flex items-center gap-1 text-sm font-bold text-fg-faint transition group-hover:text-fg">Open <Icon name="chevron-right" size={16} /></span>
		</div>
	</div>
</a>
